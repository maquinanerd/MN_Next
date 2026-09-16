import { describe, expect, it, vi } from 'vitest';

import { KalElAdmin } from '../../scripts/kalel-provision';
import { runSession, undo, type SessionDeps } from '../../scripts/wp/import-session';

/**
 * The production import session. What must hold whatever the import does: the webhooks it
 * paused are resumed, the token it minted is revoked, the token reaches the importer only,
 * and a second run that creates anything is reported as a failure of idempotency.
 */

const SITE = '11111111-2222-4333-8444-555566667777';
const cfg = { base: 'https://api.kalel.test', siteId: SITE, email: 'dono@maquinanerd.test', password: 'senha' };

type Session = Parameters<typeof undo>[1];

function harness(opts: { exits?: number[]; created?: number; leftover?: Session | null } = {}) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const hooks = [
    { id: 'h1', url: 'https://portal.test/api/revalidate', enabled: true },
    { id: 'h2', url: 'https://outro.test/hook', enabled: false },
  ];
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
    calls.push({ method, path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (method === 'GET' && url.pathname.endsWith('/webhooks')) return json(hooks);
    if (method === 'POST' && url.pathname.endsWith('/service-tokens'))
      return json({ id: 'tok1', token: 'ke_st.segredo' }, 201);
    return json({ ok: true });
  });

  const exits = [...(opts.exits ?? [0, 0])];
  const tokensSeen: string[] = [];
  let saved: Session | null = opts.leftover ?? null;
  const logs: string[] = [];
  const deps: SessionDeps = {
    admin: new KalElAdmin(cfg.base, fetchImpl as unknown as typeof fetch),
    runImport: async (_flags, token) => {
      tokensSeen.push(token);
      return exits.shift() ?? 0;
    },
    readCounts: async () => ({ created: opts.created ?? 0 }),
    saveSession: async (s) => {
      saved = s ? structuredClone(s) : null;
    },
    loadSession: async () => saved,
    log: (line) => logs.push(line),
    now: () => new Date('2026-09-16T12:00:00Z'),
  };
  return { deps, calls, tokensSeen, logs, saved: () => saved };
}

describe('wp:import-session', () => {
  it('pauses only enabled webhooks, imports twice with the token, then resumes and revokes', async () => {
    const h = harness();
    const result = await runSession(cfg, ['--uploads', 'C:/up'], h.deps);

    expect(result).toEqual({ firstExit: 0, secondExit: 0, createdOnSecondRun: 0 });
    expect(h.tokensSeen).toEqual(['ke_st.segredo', 'ke_st.segredo']);
    const writes = h.calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);
    expect(writes).toEqual([
      `PATCH /v1/admin/sites/${SITE}/webhooks/h1`,
      `POST /v1/admin/sites/${SITE}/service-tokens`,
      `PATCH /v1/admin/sites/${SITE}/webhooks/h1`,
      `POST /v1/admin/sites/${SITE}/service-tokens/tok1/revoke`,
    ]);
    const mint = h.calls.find((c) => c.path.endsWith('/service-tokens'))?.body as {
      scopes: string[];
      expiresAt: string;
    };
    expect(mint.scopes).toEqual(expect.arrayContaining(['articles.create', 'articles.publish', 'media.manage']));
    expect(mint.expiresAt).toBe('2026-09-18T12:00:00.000Z');
    expect(h.saved()).toBeNull();
    expect(h.logs.join('\n')).not.toContain('ke_st.segredo');
  });

  it('still resumes and revokes when the import fails, and skips the second run', async () => {
    const h = harness({ exits: [1] });
    const result = await runSession(cfg, [], h.deps);
    expect(result).toEqual({ firstExit: 1, secondExit: null, createdOnSecondRun: null });
    expect(h.tokensSeen).toHaveLength(1);
    const writes = h.calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);
    expect(writes.slice(-2)).toEqual([
      `PATCH /v1/admin/sites/${SITE}/webhooks/h1`,
      `POST /v1/admin/sites/${SITE}/service-tokens/tok1/revoke`,
    ]);
    expect(h.saved()).toBeNull();
  });

  it('reports a second run that created something', async () => {
    const h = harness({ created: 12 });
    expect((await runSession(cfg, [], h.deps)).createdOnSecondRun).toBe(12);
  });

  it('refuses to start over an unfinished session, and recover undoes it', async () => {
    const leftover: Session = {
      startedAt: '2026-09-15T10:00:00Z',
      siteId: SITE,
      pausedWebhooks: ['h1'],
      tokenId: 'old',
    };
    const h = harness({ leftover });
    await expect(runSession(cfg, [], h.deps)).rejects.toThrow(/--recover/);
    expect(h.calls).toEqual([]);

    await undo(cfg, leftover, h.deps);
    expect(h.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      `PATCH /v1/admin/sites/${SITE}/webhooks/h1`,
      `POST /v1/admin/sites/${SITE}/service-tokens/old/revoke`,
    ]);
    expect(h.saved()).toBeNull();
  });
});
