import { describe, expect, it, vi } from 'vitest';

import { KalElAdmin, provision } from '../../scripts/kalel-provision';

/**
 * The provisioning script, against a stand-in admin API. What matters: a dry run writes
 * nothing, an apply is idempotent, the delivery token asks for no write scope beyond the
 * ones Kal El forces on a reader, and the password never reaches the output.
 */

const SITE = '11111111-2222-4333-8444-555566667777';

function stub(existing: { categories: string[]; tags: string[]; hooks: string[] }) {
  const writes: { method: string; path: string; body: unknown }[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });
    if (url.pathname === '/v1/auth/login') {
      // Two separate Set-Cookie headers, as the API sends them.
      const headers = new Headers({ 'content-type': 'application/json' });
      headers.append('set-cookie', 'ke_session=abc; HttpOnly; Path=/');
      headers.append('set-cookie', 'ke_csrf=xyz; Path=/');
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers });
    }
    if (method !== 'GET') {
      writes.push({ method, path: url.pathname, body: JSON.parse(String(init?.body ?? 'null')) });
      return json(url.pathname.endsWith('/service-tokens') ? { id: 't1', token: 'ke_st.novo' } : { id: 'x' }, 201);
    }
    if (url.pathname.endsWith('/categories')) return json(existing.categories.map((slug) => ({ slug })));
    if (url.pathname.endsWith('/tags')) return json(existing.tags.map((slug) => ({ slug })));
    if (url.pathname.endsWith('/webhooks')) return json(existing.hooks.map((u) => ({ url: u })));
    return new Response('', { status: 404 });
  });
  return { fetchImpl, writes };
}

const cfg = (over: Partial<Parameters<typeof provision>[0]> = {}) => ({
  base: 'https://api.kalel.test',
  siteId: SITE,
  email: 'dono@maquinanerd.test',
  password: 'senha-que-nao-pode-vazar',
  portal: 'https://www.maquinanerd.test',
  webhookSecret: 'w'.repeat(40),
  apply: false,
  newToken: false,
  ...over,
});

describe('kalel:provision', () => {
  it('a dry run reports the plan and writes nothing', async () => {
    const { fetchImpl, writes } = stub({ categories: ['cinema'], tags: [], hooks: [] });
    const lines: string[] = [];
    const plan = await provision(
      cfg(),
      new KalElAdmin('https://api.kalel.test', fetchImpl as unknown as typeof fetch),
      (l) => lines.push(l),
    );
    expect(writes).toEqual([]);
    expect(plan.categories).not.toContain('cinema');
    expect(plan.categories).toHaveLength(6);
    expect(plan.webhook).toBe(true);
    expect(lines.join('\n')).toContain('dry run');
  });

  it('an apply creates only what is missing, and a second apply creates nothing', async () => {
    const all = ['cinema', 'series-e-tv', 'games', 'quadrinhos', 'animes', 'videos', 'especiais'];
    const hook = 'https://www.maquinanerd.test/api/revalidate';
    const { fetchImpl, writes } = stub({ categories: all, tags: ['capa-em-tela-cheia', 'oferta'], hooks: [hook] });
    await provision(
      cfg({ apply: true }),
      new KalElAdmin('https://api.kalel.test', fetchImpl as unknown as typeof fetch),
      () => {},
    );
    expect(writes).toEqual([]);
  });

  it('registers the webhook with the shared secret and the two events the portal handles', async () => {
    const { fetchImpl, writes } = stub({ categories: [], tags: [], hooks: [] });
    await provision(
      cfg({ apply: true }),
      new KalElAdmin('https://api.kalel.test', fetchImpl as unknown as typeof fetch),
      () => {},
    );
    const hook = writes.find((w) => w.path.endsWith('/webhooks'));
    expect(hook?.body).toMatchObject({
      url: 'https://www.maquinanerd.test/api/revalidate',
      events: ['article.published', 'article.updated'],
      secret: 'w'.repeat(40),
    });
  });

  it('asks for a delivery token with read scopes and no article write scope', async () => {
    const { fetchImpl, writes } = stub({ categories: [], tags: [], hooks: [] });
    const lines: string[] = [];
    await provision(
      cfg({ apply: true, newToken: true }),
      new KalElAdmin('https://api.kalel.test', fetchImpl as unknown as typeof fetch),
      (l) => lines.push(l),
    );
    const token = writes.find((w) => w.path.endsWith('/service-tokens'))?.body as { scopes: string[] };
    expect(token.scopes).toContain('articles.read');
    expect(token.scopes.some((s) => /^articles\.(create|update|publish|schedule)$/.test(s))).toBe(false);
    expect(lines.join('\n')).toContain('KAL_EL_SERVICE_TOKEN=ke_st.novo');
  });

  it('never prints the password', async () => {
    const { fetchImpl } = stub({ categories: [], tags: [], hooks: [] });
    const lines: string[] = [];
    await provision(
      cfg({ apply: true, newToken: true }),
      new KalElAdmin('https://api.kalel.test', fetchImpl as unknown as typeof fetch),
      (l) => lines.push(l),
    );
    expect(lines.join('\n')).not.toContain('senha-que-nao-pode-vazar');
  });
});
