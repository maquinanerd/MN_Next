import { describe, expect, it, vi } from 'vitest';

import { KalElAdmin } from '../../scripts/kalel-provision';
import { finish, prepare, type ServiceToken, type Webhook } from '../../scripts/kalel-rotate';

/**
 * The credential rotation, against a stand-in admin API. What matters: nothing is written
 * without --apply; the new token and webhook exist before anything old is revoked; only
 * the portal's credentials are touched — never MN-Prime's token, never another
 * subscriber's webhook; and neither the password nor the leaked token reaches the output.
 */

const SITE = '11111111-2222-4333-8444-555566667777';
const BASE = 'https://api.kalel.test';
const HOOK = 'https://portal-abc.sslip.io/api/revalidate';
const LEAKED = 'ke_st.vazado-que-nao-pode-aparecer';
const PASSWORD = 'senha-que-nao-pode-vazar';

const token = (over: Partial<ServiceToken>): ServiceToken => ({
  id: 'x',
  name: 'x',
  scopes: ['articles.read'],
  expiresAt: null,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-09-16T00:00:00.000Z',
  ...over,
});

function stub(state: { tokens: ServiceToken[]; hooks: Webhook[] }) {
  const writes: { method: string; path: string; body: unknown }[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/v1/auth/login') {
      const headers = new Headers({ 'content-type': 'application/json' });
      headers.append('set-cookie', 'ke_session=abc; HttpOnly; Path=/');
      headers.append('set-cookie', 'ke_csrf=xyz; Path=/');
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers });
    }
    if (url.pathname === '/v1/auth/me') {
      const bearer = new Headers(init?.headers).get('authorization');
      return bearer === `Bearer ${LEAKED}` ? json({ kind: 'service', id: 't-portal' }) : json({}, 401);
    }
    if (method !== 'GET') {
      writes.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.pathname.endsWith('/service-tokens')) return json({ id: 't-novo', token: 'ke_st.novo' }, 201);
      if (url.pathname.endsWith('/webhooks')) return json({ id: `w-novo-${writes.length}` }, 201);
      return json({ id: 'ok' });
    }
    if (url.pathname.endsWith('/service-tokens')) return json(state.tokens);
    if (url.pathname.endsWith('/webhooks')) return json(state.hooks);
    return new Response('', { status: 404 });
  });
  return { fetchImpl, writes, admin: new KalElAdmin(BASE, fetchImpl as unknown as typeof fetch) };
}

const cfg = (apply: boolean) => ({
  base: BASE,
  siteId: SITE,
  email: 'dono@maquinanerd.test',
  password: PASSWORD,
  apply,
});

const site = () => ({
  tokens: [
    token({ id: 't-portal', name: 'maquinanerd-portal-entrega', lastUsedAt: '2026-11-26T23:00:00.000Z' }),
    token({ id: 't-import', name: 'maquinanerd-portal-importacao' }),
    token({ id: 't-prime', name: 'mn-prime-publicacao', scopes: ['articles.publish'] }),
    token({ id: 't-velho', name: 'maquinanerd-portal-entrega', revokedAt: '2026-09-20T00:00:00.000Z' }),
  ],
  hooks: [
    { id: 'w-portal', url: HOOK, events: ['article.published', 'article.updated'], enabled: true, createdAt: '' },
    { id: 'w-outro', url: 'https://outro.example/hook', events: ['article.published'], enabled: true, createdAt: '' },
  ],
});

describe('kalel:rotate prepare', () => {
  it('a dry run finds the leaked token and writes nothing', async () => {
    const { admin, fetchImpl, writes } = stub(site());
    const lines: string[] = [];
    const result = await prepare(
      cfg(false),
      { newWebhookSecret: 's'.repeat(64), leakedToken: LEAKED },
      admin,
      (l) => lines.push(l),
      fetchImpl as unknown as typeof fetch,
    );
    expect(writes).toEqual([]);
    expect(result.leakedTokenId).toBe('t-portal');
    expect(result.token).toBeUndefined();
    expect(lines.join('\n')).toContain('dry run');
  });

  it('creates a delivery token with the same scopes and a webhook on the URL the old one used', async () => {
    const { admin, fetchImpl, writes } = stub(site());
    const lines: string[] = [];
    const result = await prepare(
      cfg(true),
      { newWebhookSecret: 's'.repeat(64), leakedToken: LEAKED, now: new Date('2026-11-27T03:00:00Z') },
      admin,
      (l) => lines.push(l),
      fetchImpl as unknown as typeof fetch,
    );

    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([
      `POST /v1/admin/sites/${SITE}/service-tokens`,
      `POST /v1/admin/sites/${SITE}/webhooks`,
    ]);
    expect(writes[0]?.body).toMatchObject({
      name: 'maquinanerd-portal-entrega-2026-11-27',
      scopes: expect.arrayContaining(['articles.read', 'media.read', 'seo.manage']),
      expiresAt: null,
    });
    expect(writes[0]?.body).not.toHaveProperty('scopes', expect.arrayContaining(['articles.publish']));
    expect(writes[1]?.body).toMatchObject({
      url: HOOK,
      events: ['article.published', 'article.updated'],
      secret: 's'.repeat(64),
    });
    expect(result).toMatchObject({ token: { id: 't-novo', secret: 'ke_st.novo' }, leakedTokenId: 't-portal' });

    const out = lines.join('\n');
    expect(out).toContain('KAL_EL_SERVICE_TOKEN=ke_st.novo');
    expect(out).toContain('NEW_TOKEN_ID=t-novo');
    expect(out).toContain('LEAKED_TOKEN_ID=t-portal');
    expect(out).not.toContain(PASSWORD);
    expect(out).not.toContain(LEAKED);
    expect(out).not.toContain('s'.repeat(64));
  });

  it('refuses a webhook secret the portal would refuse', async () => {
    const { admin } = stub(site());
    await expect(prepare(cfg(true), { newWebhookSecret: 'curto' }, admin, () => {})).rejects.toThrow(/32 to 128/);
  });
});

describe('kalel:rotate finish', () => {
  const after = () => {
    const s = site();
    s.tokens.push(token({ id: 't-novo', name: 'maquinanerd-portal-entrega-2026-11-27' }));
    s.hooks.push({ id: 'w-novo', url: HOOK, events: ['article.published'], enabled: true, createdAt: '' });
    return s;
  };

  it("revokes the portal's tokens and deletes its old webhook — and nothing of anyone else", async () => {
    const { admin, writes } = stub(after());
    const lines: string[] = [];
    const result = await finish(
      cfg(true),
      { keepTokenId: 't-novo', keepWebhookIds: ['w-novo'], revokeTokenIds: ['t-portal'] },
      admin,
      (l) => lines.push(l),
    );

    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([
      `POST /v1/admin/sites/${SITE}/service-tokens/t-portal/revoke`,
      `POST /v1/admin/sites/${SITE}/service-tokens/t-import/revoke`,
      `DELETE /v1/admin/sites/${SITE}/webhooks/w-portal`,
    ]);
    expect(result).toEqual({ revoked: ['t-portal', 't-import'], deletedWebhooks: ['w-portal'] });
    expect(lines.join('\n')).toContain('mantido (outro consumidor): t-prime "mn-prime-publicacao"');
  });

  it('revokes a token it is told leaked, whatever its name', async () => {
    const { admin, writes } = stub(after());
    await finish(
      cfg(true),
      { keepTokenId: 't-novo', keepWebhookIds: ['w-novo'], revokeTokenIds: ['t-prime'] },
      admin,
      () => {},
    );
    expect(writes.map((w) => w.path)).toContain(`/v1/admin/sites/${SITE}/service-tokens/t-prime/revoke`);
  });

  it('touches nothing when the new token is not there', async () => {
    const { admin, writes } = stub(site());
    await expect(
      finish(cfg(true), { keepTokenId: 't-novo', keepWebhookIds: ['w-novo'] }, admin, () => {}),
    ).rejects.toThrow(/missing or revoked/);
    expect(writes).toEqual([]);
  });

  it('a dry run lists what it would do and writes nothing', async () => {
    const { admin, writes } = stub(after());
    const lines: string[] = [];
    await finish(cfg(false), { keepTokenId: 't-novo', keepWebhookIds: ['w-novo'] }, admin, (l) => lines.push(l));
    expect(writes).toEqual([]);
    expect(lines.join('\n')).toMatch(/a revogar: t-portal/);
    expect(lines.join('\n')).toContain('dry run');
  });
});
