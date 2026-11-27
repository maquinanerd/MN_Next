import { describe, expect, it, vi } from 'vitest';

import { KalElAdmin } from '../../scripts/kalel-provision';
import { finish, prepare, type ServiceToken, type Webhook } from '../../scripts/kalel-rotate';

/**
 * The credential rotation, against a stand-in admin API. What matters:
 *   - nothing is written without --apply;
 *   - nothing is revoked unless the portal's environment holds the new token AND the
 *     running portal used it — a failed Coolify update or deploy cannot take the live
 *     portal's token away;
 *   - only what it is given by id is revoked, and only the portal's webhooks (by host) are
 *     replaced: never MN-Prime's token, never another subscriber's webhook;
 *   - neither the password, the leaked token nor the new webhook secret reaches the output,
 *     and the new token is printed once, last.
 */

const SITE = '11111111-2222-4333-8444-555566667777';
const BASE = 'https://api.kalel.test';
const ORIGIN = 'portal-abc.sslip.io';
const HOOK = `https://${ORIGIN}/api/revalidate`;
const HOSTS = [ORIGIN, 'www.maquinanerd.test'];
const LEAKED = 'ke_st.vazado-que-nao-pode-aparecer';
const NEW = 'ke_st.novo';
const PASSWORD = 'senha-que-nao-pode-vazar';
const SECRET = 's'.repeat(64);

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

const hook = (id: string, url: string): Webhook => ({
  id,
  url,
  events: ['article.published', 'article.updated'],
  enabled: true,
  createdAt: '',
});

interface State {
  tokens: ServiceToken[];
  hooks: Webhook[];
  /** Which token each bearer value authenticates as. */
  bearers: Record<string, string>;
  failWebhookCreate?: boolean;
  csrfInBodyOnly?: boolean;
}

function stub(state: State) {
  const writes: { method: string; path: string; body: unknown }[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/v1/auth/login') {
      const headers = new Headers({ 'content-type': 'application/json' });
      headers.append('set-cookie', 'ke_session=abc; HttpOnly; Path=/');
      if (!state.csrfInBodyOnly) headers.append('set-cookie', 'ke_csrf=xyz; Path=/');
      return new Response(JSON.stringify({ data: { csrfToken: 'xyz' } }), { status: 200, headers });
    }
    if (url.pathname === '/v1/auth/me') {
      const bearer = new Headers(init?.headers).get('authorization')?.replace(/^Bearer /, '') ?? '';
      const id = state.bearers[bearer];
      const t = state.tokens.find((x) => x.id === id);
      if (!t) return json({}, 401);
      if (t.revokedAt) return json({}, 403);
      return json({ kind: 'service', id: t.id, name: t.name });
    }
    if (method !== 'GET') {
      if (new Headers(init?.headers).get('x-kal-el-csrf') !== 'xyz') return json({}, 403);
      writes.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
      if (url.pathname.endsWith('/service-tokens')) return json({ id: 't-novo', token: NEW }, 201);
      if (url.pathname.endsWith('/webhooks')) {
        if (state.failWebhookCreate) return json({ message: 'boom' }, 500);
        return json({ id: `w-novo-${writes.length}` }, 201);
      }
      const revoke = /\/service-tokens\/([^/]+)\/revoke$/.exec(url.pathname);
      const revokedToken = state.tokens.find((t) => t.id === revoke?.[1]);
      if (revokedToken) revokedToken.revokedAt = '2026-11-27T03:20:00.000Z';
      return json({ id: 'ok' });
    }
    if (url.pathname.endsWith('/service-tokens')) return json(state.tokens);
    if (url.pathname.endsWith('/webhooks')) return json(state.hooks);
    return new Response('', { status: 404 });
  });
  return {
    writes,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    admin: new KalElAdmin(BASE, fetchImpl as unknown as typeof fetch),
  };
}

const cfg = (apply: boolean) => ({
  base: BASE,
  siteId: SITE,
  email: 'dono@maquinanerd.test',
  password: PASSWORD,
  apply,
});

const site = (): State => ({
  tokens: [
    token({ id: 't-portal', name: 'maquinanerd-portal-entrega', lastUsedAt: '2026-11-26T23:00:00.000Z' }),
    token({ id: 't-staging', name: 'maquinanerd-portal-entrega-staging' }),
    token({ id: 't-import', name: 'maquinanerd-importacao-2026-09-16' }),
    token({ id: 't-prime', name: 'mn-prime-publicacao', scopes: ['articles.publish'] }),
  ],
  hooks: [
    hook('w-portal', HOOK),
    hook('w-staging', 'https://staging.example/api/revalidate'),
    hook('w-outro', 'https://outro.example/hook'),
  ],
  bearers: { [LEAKED]: 't-portal' },
});

describe('kalel:rotate prepare', () => {
  it('a dry run finds the leaked token and writes nothing', async () => {
    const { admin, fetchImpl, writes } = stub(site());
    const lines: string[] = [];
    const result = await prepare(
      cfg(false),
      { newWebhookSecret: SECRET, leakedToken: LEAKED, portalHosts: HOSTS },
      admin,
      (l) => lines.push(l),
      fetchImpl,
    );
    expect(writes).toEqual([]);
    expect(result.leaked).toEqual({ id: 't-portal', name: 'maquinanerd-portal-entrega' });
    expect(result.token).toBeUndefined();
    expect(lines.join('\n')).toContain('dry run');
  });

  it("creates a delivery token and a webhook on the portal's own URL, and leaves other hosts alone", async () => {
    const { admin, fetchImpl, writes } = stub(site());
    const lines: string[] = [];
    const result = await prepare(
      cfg(true),
      { newWebhookSecret: SECRET, leakedToken: LEAKED, portalHosts: HOSTS, now: new Date('2026-11-27T03:00:00Z') },
      admin,
      (l) => lines.push(l),
      fetchImpl,
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
    expect((writes[0]?.body as { scopes: string[] }).scopes).not.toContain('articles.publish');
    expect(writes[1]?.body).toMatchObject({
      url: HOOK,
      events: ['article.published', 'article.updated'],
      secret: SECRET,
    });
    expect(result).toMatchObject({ token: { id: 't-novo', secret: NEW }, leaked: { id: 't-portal' } });

    const out = lines.join('\n');
    expect(lines.filter((l) => l.startsWith('KAL_EL_SERVICE_TOKEN='))).toEqual([`KAL_EL_SERVICE_TOKEN=${NEW}`]);
    expect(lines.at(-1)).toBe(`KAL_EL_SERVICE_TOKEN=${NEW}`);
    expect(out).toContain('NEW_TOKEN_ID=t-novo');
    expect(out).toContain('LEAKED_TOKEN_ID=t-portal');
    expect(out).toContain('LEAKED_TOKEN_NAME=maquinanerd-portal-entrega');
    expect(out).toContain('outros assinantes (não mexo): https://staging.example/api/revalidate');
    for (const secret of [PASSWORD, LEAKED, SECRET]) expect(out).not.toContain(secret);
  });

  it('replaces each portal URL with its own new webhook', async () => {
    const state = site();
    state.hooks.push(hook('w-www', 'https://www.maquinanerd.test/api/revalidate'));
    const { admin, fetchImpl, writes } = stub(state);
    const result = await prepare(
      cfg(true),
      { newWebhookSecret: SECRET, portalHosts: HOSTS },
      admin,
      () => {},
      fetchImpl,
    );
    expect(writes.filter((w) => w.path.endsWith('/webhooks')).map((w) => (w.body as { url: string }).url)).toEqual([
      HOOK,
      'https://www.maquinanerd.test/api/revalidate',
    ]);
    expect(result.webhookIds).toHaveLength(2);
  });

  it('never prints the new token when a later step fails', async () => {
    const state = site();
    state.failWebhookCreate = true;
    const { admin, fetchImpl } = stub(state);
    const lines: string[] = [];
    await expect(
      prepare(cfg(true), { newWebhookSecret: SECRET, portalHosts: HOSTS }, admin, (l) => lines.push(l), fetchImpl),
    ).rejects.toThrow(/HTTP 500/);
    expect(lines.join('\n')).not.toContain(NEW);
    expect(lines.join('\n')).toContain('NEW_TOKEN_ID=t-novo');
  });

  it('warns when the leaked token is not named as the portal’s', async () => {
    const state = site();
    state.bearers = { [LEAKED]: 't-prime' };
    const { admin, fetchImpl } = stub(state);
    const lines: string[] = [];
    await prepare(
      cfg(false),
      { newWebhookSecret: SECRET, leakedToken: LEAKED, portalHosts: HOSTS },
      admin,
      (l) => lines.push(l),
      fetchImpl,
    );
    expect(lines.join('\n')).toMatch(/ATENÇÃO: o token vazado se chama "mn-prime-publicacao"/);
  });

  it('refuses a webhook secret the portal would refuse, and a run without the portal hosts', async () => {
    const { admin } = stub(site());
    await expect(
      prepare(cfg(true), { newWebhookSecret: 'curto', portalHosts: HOSTS }, admin, () => {}),
    ).rejects.toThrow(/32 to 128/);
    await expect(prepare(cfg(true), { newWebhookSecret: SECRET, portalHosts: [] }, admin, () => {})).rejects.toThrow(
      /PORTAL_HOSTS/,
    );
  });

  it('logs in with the CSRF token from the body when no cookie carries it', async () => {
    const state = site();
    state.csrfInBodyOnly = true;
    const { admin, fetchImpl, writes } = stub(state);
    await prepare(cfg(true), { newWebhookSecret: SECRET, portalHosts: HOSTS }, admin, () => {}, fetchImpl);
    expect(writes).toHaveLength(2);
  });
});

describe('kalel:rotate finish', () => {
  /** The site after `prepare`, with the new token in the portal and used by it on the probe. */
  const after = (opts: { liveUses?: boolean; leakedAlsoUsed?: boolean } = {}) => {
    const state = site();
    state.tokens.push(token({ id: 't-novo', name: 'maquinanerd-portal-entrega-2026-11-27' }));
    state.hooks.push(hook('w-novo', HOOK));
    state.bearers[NEW] = 't-novo';
    const touch = (id: string) => {
      const t = state.tokens.find((x) => x.id === id);
      if (t) t.lastUsedAt = '2026-11-27T03:10:00.000Z';
    };
    const probe = async () => {
      if (opts.liveUses !== false) touch('t-novo');
      // A build reading Kal El with the new token while the old container still answers.
      if (opts.leakedAlsoUsed) touch('t-portal');
    };
    return { state, probe };
  };
  const input = (over: Partial<Parameters<typeof finish>[1]> = {}) => ({
    keepTokenId: 't-novo',
    keepWebhookIds: ['w-novo'],
    revokeTokenIds: ['t-portal'],
    currentToken: NEW,
    portalHosts: HOSTS,
    ...over,
  });

  it("revokes the leaked token and deletes the portal's old webhook — nothing else", async () => {
    const { state, probe } = after();
    const { admin, fetchImpl, writes } = stub(state);
    const lines: string[] = [];
    const result = await finish(cfg(true), input({ probe }), admin, (l) => lines.push(l), fetchImpl);

    expect(writes.map((w) => `${w.method} ${w.path}`)).toEqual([
      `POST /v1/admin/sites/${SITE}/service-tokens/t-portal/revoke`,
      `DELETE /v1/admin/sites/${SITE}/webhooks/w-portal`,
    ]);
    expect(result).toEqual({ revoked: ['t-portal'], deletedWebhooks: ['w-portal'], stillActive: [] });
    const out = lines.join('\n');
    expect(out).toContain('conferido: o portal no ar usa o token novo');
    expect(out).not.toContain('ATENÇÃO');
    expect(lines.at(-1)).toBe('STILL_ACTIVE_IDS=');
    for (const kept of ['t-staging', 't-import', 't-prime']) expect(out).toMatch(new RegExp(`mantido: ${kept} `));
  });

  it('refuses to apply without a probe of the running portal', async () => {
    const { state } = after();
    const { admin, fetchImpl, writes } = stub(state);
    await expect(finish(cfg(true), input(), admin, () => {}, fetchImpl)).rejects.toThrow(
      /PORTAL_READY_URL is required/,
    );
    expect(writes).toEqual([]);
  });

  it('warns when the token to revoke is still in use during the probe (an old container still answering)', async () => {
    const { state, probe } = after({ leakedAlsoUsed: true });
    const { admin, fetchImpl } = stub(state);
    const lines: string[] = [];
    await finish(cfg(false), input({ probe }), admin, (l) => lines.push(l), fetchImpl);
    expect(lines.join('\n')).toMatch(
      /ATENÇÃO: t-portal "maquinanerd-portal-entrega" também foi usado durante a conferência/,
    );
  });

  it('revokes nothing while the portal still holds the leaked token (the Coolify update failed)', async () => {
    const { state, probe } = after();
    const { admin, fetchImpl, writes } = stub(state);
    await expect(finish(cfg(true), input({ currentToken: LEAKED, probe }), admin, () => {}, fetchImpl)).rejects.toThrow(
      /does not hold the new token t-novo \(it holds t-portal\)/,
    );
    expect(writes).toEqual([]);
  });

  it('revokes nothing while the running portal has not used the new token (the deploy did not go live)', async () => {
    const { state, probe } = after({ liveUses: false });
    const { admin, fetchImpl, writes } = stub(state);
    await expect(finish(cfg(true), input({ probe }), admin, () => {}, fetchImpl)).rejects.toThrow(
      /did not use the new token/,
    );
    expect(writes).toEqual([]);
  });

  it('skips a listed token named otherwise unless that very id was confirmed', async () => {
    const run = async (allowForeignIds: string[]) => {
      const { state, probe } = after();
      state.tokens.push(token({ id: 't-outro', name: 'cms-integracao' }));
      const { admin, fetchImpl, writes } = stub(state);
      const lines: string[] = [];
      const result = await finish(
        cfg(true),
        input({ revokeTokenIds: ['t-prime', 't-outro'], allowForeignIds, probe }),
        admin,
        (l) => lines.push(l),
        fetchImpl,
      );
      return { writes: writes.map((w) => w.path), out: lines.join('\n'), result };
    };
    const revokePath = (id: string) => `/v1/admin/sites/${SITE}/service-tokens/${id}/revoke`;

    const refused = await run([]);
    expect(refused.writes).not.toContain(revokePath('t-prime'));
    expect(refused.out).toMatch(/NÃO revogo sem confirmação \(outro nome\): t-prime/);
    expect(refused.result.stillActive).toEqual(['t-prime', 't-outro']);

    // The confirmation covers the id it was given, not every foreign token on the list.
    const oneConfirmed = await run(['t-prime']);
    expect(oneConfirmed.writes).toContain(revokePath('t-prime'));
    expect(oneConfirmed.writes).not.toContain(revokePath('t-outro'));
    expect(oneConfirmed.out).toContain('STILL_ACTIVE_IDS=t-outro');
  });

  it('never revokes the new token, even when it is listed', async () => {
    const { state, probe } = after();
    const { admin, fetchImpl, writes } = stub(state);
    await finish(cfg(true), input({ revokeTokenIds: ['t-portal', 't-novo'], probe }), admin, () => {}, fetchImpl);
    expect(writes.map((w) => w.path)).not.toContain(`/v1/admin/sites/${SITE}/service-tokens/t-novo/revoke`);
  });

  it('keeps every new webhook when the portal has two URLs', async () => {
    const { state, probe } = after();
    state.hooks.push(hook('w-www', 'https://www.maquinanerd.test/api/revalidate'));
    state.hooks.push(hook('w-www-novo', 'https://www.maquinanerd.test/api/revalidate'));
    const { admin, fetchImpl, writes } = stub(state);
    await finish(cfg(true), input({ keepWebhookIds: ['w-novo', 'w-www-novo'], probe }), admin, () => {}, fetchImpl);
    expect(writes.filter((w) => w.method === 'DELETE').map((w) => w.path)).toEqual([
      `/v1/admin/sites/${SITE}/webhooks/w-portal`,
      `/v1/admin/sites/${SITE}/webhooks/w-www`,
    ]);
  });

  it('touches nothing when the new token is not there', async () => {
    const { admin, fetchImpl, writes } = stub(site());
    const probe = async () => {};
    await expect(finish(cfg(true), input({ currentToken: NEW, probe }), admin, () => {}, fetchImpl)).rejects.toThrow(
      /does not hold the new token/,
    );
    expect(writes).toEqual([]);
  });

  it('a dry run checks everything and writes nothing', async () => {
    const { state, probe } = after();
    const { admin, fetchImpl, writes } = stub(state);
    const lines: string[] = [];
    await finish(cfg(false), input({ probe }), admin, (l) => lines.push(l), fetchImpl);
    expect(writes).toEqual([]);
    const out = lines.join('\n');
    expect(out).toMatch(/a revogar: t-portal/);
    expect(out).toContain('conferido: o portal no ar usa o token novo');
    expect(out).toContain('dry run');
  });
});
