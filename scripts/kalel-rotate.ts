import { DELIVERY_SCOPES, KalElAdmin } from './kalel-provision';
import { runAsScript } from './wp/cli';

/**
 * Rotates the portal's Kal El credentials after a leak — the delivery token and the
 * revalidation webhook's signing secret — in two phases, so the portal never runs without
 * a working pair:
 *
 *   pnpm kalel:rotate prepare [--apply]   # a new token and a new webhook; the old ones
 *                                         # keep working until `finish`
 *   (store the new values in the portal and deploy it)
 *   pnpm kalel:rotate finish [--apply]    # proves the running portal uses the new token,
 *                                         # then revokes the leaked one and deletes the old
 *                                         # webhook(s)
 *
 * Nothing is written without `--apply`; `finish` runs its checks either way. Production
 * goes through scripts/rotacionar-segredos.ps1, which runs both phases around the Coolify
 * update and the deploy.
 *
 * Environment (never flags: an argument is visible in the process list):
 *   KAL_EL_BASE_URL, KAL_EL_SITE_ID, KALEL_ADMIN_EMAIL, KALEL_ADMIN_PASSWORD
 *   PORTAL_HOSTS          comma-separated hosts of the portal (www, apex, the sslip.io origin
 *                          Kal El delivers to). Only webhooks on these hosts are the portal's.
 *   prepare  NEW_WEBHOOK_SECRET    32–128 characters, the value the portal will verify with
 *            LEAKED_SERVICE_TOKEN  the token that leaked, to find its id and name through
 *                                  /v1/auth/me (never printed)
 *            PORTAL_PUBLIC_URL     only when no portal webhook exists yet
 *   finish   KEEP_TOKEN_ID, KEEP_WEBHOOK_IDS   from `prepare`
 *            REVOKE_TOKEN_IDS      the leaked token's id (plus leftovers of an earlier run)
 *            CURRENT_SERVICE_TOKEN the token the portal's environment holds right now
 *            PORTAL_READY_URL      a request that makes the running portal read Kal El
 *                                  (required with --apply)
 *            ALLOW_FOREIGN_REVOKE_IDS  listed ids to revoke although not named maquinanerd-portal…
 *
 * What it touches, and only that:
 *   - the service tokens it is given by id — never by name pattern. A listed token whose
 *     name is not `maquinanerd-portal…` (MN-Prime's is `mn-prime-publicacao`) is skipped
 *     unless its id is in ALLOW_FOREIGN_REVOKE_IDS;
 *   - webhooks on the portal's hosts whose path is `/api/revalidate`.
 *
 * `finish` refuses to revoke anything unless the token in the portal's environment is the
 * new one AND the running portal used it: the new token's `lastUsedAt` must move when
 * PORTAL_READY_URL is requested. A failed Coolify update or deploy therefore cannot end with
 * the live portal's token revoked.
 */

const PORTAL_TOKEN_PREFIX = 'maquinanerd-portal';
const HOOK_PATH = '/api/revalidate';
const DEFAULT_EVENTS = ['article.published', 'article.updated'];

export interface ServiceToken {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

export interface RotateConfig {
  base: string;
  siteId: string;
  email: string;
  password: string;
  apply: boolean;
}

export interface PrepareInput {
  newWebhookSecret: string;
  portalHosts: string[];
  leakedToken?: string;
  portal?: string;
  /** Today, for the new token's and webhook's names. */
  now?: Date;
  expiresInDays?: number;
}

export interface PrepareResult {
  token?: { id: string; secret: string };
  webhookIds: string[];
  leaked?: { id: string; name: string };
}

const hostsOf = (hosts: string[]): Set<string> => new Set(hosts.map((h) => h.trim().toLowerCase()).filter(Boolean));

function portalHookFilter(hosts: string[]): (w: Webhook) => boolean {
  const allowed = hostsOf(hosts);
  if (allowed.size === 0) throw new Error('PORTAL_HOSTS is required: the hosts the portal answers on');
  return (w) => {
    try {
      const url = new URL(w.url);
      return allowed.has(url.hostname.toLowerCase()) && url.pathname.replace(/\/+$/, '') === HOOK_PATH;
    } catch {
      return false;
    }
  };
}

function describeToken(t: ServiceToken): string {
  const state = t.revokedAt ? `revogado em ${t.revokedAt}` : 'ativo';
  return `${t.id} "${t.name}" — ${state}; criado ${t.createdAt}; último uso ${t.lastUsedAt ?? 'nunca'}`;
}

/** The token behind a credential, through the endpoint that answers who is calling. */
async function whoIs(
  base: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<{ id: string; name: string } | undefined> {
  const res = await fetchImpl(`${base}/v1/auth/me`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return undefined;
  const me = (await res.json()) as { data?: { kind?: string; id?: string; name?: string } };
  return me.data?.kind === 'service' && me.data.id ? { id: me.data.id, name: me.data.name ?? '' } : undefined;
}

export async function prepare(
  cfg: RotateConfig,
  input: PrepareInput,
  admin: KalElAdmin,
  log: (line: string) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<PrepareResult> {
  if (input.newWebhookSecret.length < 32 || input.newWebhookSecret.length > 128) {
    throw new Error('NEW_WEBHOOK_SECRET must be 32 to 128 characters');
  }
  const isPortalHook = portalHookFilter(input.portalHosts);
  const now = input.now ?? new Date();
  const stamp = now.toISOString().slice(0, 10);

  const leaked = input.leakedToken ? await whoIs(cfg.base, input.leakedToken, fetchImpl) : undefined;
  if (input.leakedToken) {
    log(
      leaked
        ? `token vazado identificado: ${leaked.id} "${leaked.name}" (ainda ativo)`
        : 'o token vazado já não autentica (revogado, expirado ou inexistente)',
    );
  }
  if (leaked && !leaked.name.startsWith(PORTAL_TOKEN_PREFIX)) {
    log(
      `ATENÇÃO: o token vazado se chama "${leaked.name}", não ${PORTAL_TOKEN_PREFIX}…. Se outro consumidor ` +
        '(o MN-Prime) usa o mesmo token, ele para de publicar quando este for revogado.',
    );
  }

  await admin.login(cfg.email, cfg.password);
  const admin_ = `/v1/admin/sites/${cfg.siteId}`;
  const tokens = await admin.call<ServiceToken[]>('GET', `${admin_}/service-tokens`);
  const webhooks = await admin.call<Webhook[]>('GET', `${admin_}/webhooks`);

  log(`tokens do site (${tokens.length}):`);
  for (const t of tokens) log(`  ${describeToken(t)}`);

  const portalHooks = webhooks.filter(isPortalHook);
  const urls = [...new Set(portalHooks.map((w) => w.url))];
  if (urls.length === 0) {
    if (!input.portal) throw new Error(`no portal webhook at ${HOOK_PATH}; set PORTAL_PUBLIC_URL`);
    const url = `${input.portal.replace(/\/+$/, '')}${HOOK_PATH}`;
    if (!isPortalHook({ id: '', url, events: [], enabled: true, createdAt: '' })) {
      throw new Error('PORTAL_PUBLIC_URL is not one of PORTAL_HOSTS');
    }
    urls.push(url);
  }
  log(`webhooks do portal: ${portalHooks.map((w) => `${w.id} ${w.url}`).join(', ') || 'nenhum'}`);
  const others = webhooks.filter((w) => !isPortalHook(w));
  if (others.length) log(`webhooks de outros assinantes (não mexo): ${others.map((w) => w.url).join(', ')}`);
  log(`a criar: 1 token "${PORTAL_TOKEN_PREFIX}-entrega-${stamp}" e ${urls.length} webhook(s) para ${urls.join(', ')}`);

  const leakedResult = leaked ? { leaked } : {};
  if (!cfg.apply) {
    log('dry run — nada foi escrito. Rode com --apply para aplicar.');
    return { webhookIds: [], ...leakedResult };
  }

  const expiresAt = input.expiresInDays
    ? new Date(now.getTime() + input.expiresInDays * 86_400_000).toISOString()
    : null;
  const created = await admin.call<{ id: string; token?: string; secret?: string }>(
    'POST',
    `${admin_}/service-tokens`,
    {
      name: `${PORTAL_TOKEN_PREFIX}-entrega-${stamp}`,
      scopes: DELIVERY_SCOPES,
      expiresAt,
    },
  );
  const secret = created.token ?? created.secret;
  if (!secret)
    throw new Error(`Kal El created token ${created.id} but did not answer its secret; revoke it in the CMS`);
  log(`token criado: ${created.id}`);
  log(`NEW_TOKEN_ID=${created.id}`);

  const webhookIds: string[] = [];
  for (const url of urls) {
    const events = portalHooks.find((w) => w.url === url)?.events ?? DEFAULT_EVENTS;
    const hook = await admin.call<{ id: string }>('POST', `${admin_}/webhooks`, {
      url,
      events,
      description: `Máquina Nerd — revalidação do portal (rotação ${stamp})`,
      secret: input.newWebhookSecret,
    });
    webhookIds.push(hook.id);
    log(`webhook criado: ${hook.id} ${url}`);
  }

  log(`NEW_WEBHOOK_IDS=${webhookIds.join(',')}`);
  if (leaked) {
    log(`LEAKED_TOKEN_ID=${leaked.id}`);
    log(`LEAKED_TOKEN_NAME=${leaked.name}`);
  }
  // Last, and only once everything was created: the wrapper stores it in Coolify and
  // nowhere else. A failure above never prints a secret.
  log(`KAL_EL_SERVICE_TOKEN=${secret}`);
  return { token: { id: created.id, secret }, webhookIds, ...leakedResult };
}

export interface FinishInput {
  keepTokenId: string;
  keepWebhookIds: string[];
  revokeTokenIds: string[];
  /** The token the portal's environment holds now; it must be the new one. */
  currentToken: string;
  portalHosts: string[];
  /** Listed ids the owner confirmed revoking although they are not named maquinanerd-portal…. */
  allowForeignIds?: string[];
  /** A request that makes the running portal read Kal El with its token. Required to apply. */
  probe?: () => Promise<void>;
}

export interface FinishResult {
  revoked: string[];
  deletedWebhooks: string[];
  /** Listed ids still active afterwards (another consumer's, not confirmed). */
  stillActive: string[];
}

const usedAfter = (before: string | null, after: string | null): boolean =>
  after !== null && (before === null || Date.parse(after) > Date.parse(before));

export async function finish(
  cfg: RotateConfig,
  input: FinishInput,
  admin: KalElAdmin,
  log: (line: string) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<FinishResult> {
  if (!input.keepTokenId || input.keepWebhookIds.length === 0) {
    throw new Error('KEEP_TOKEN_ID and KEEP_WEBHOOK_IDS are required: run `prepare` first');
  }
  if (cfg.apply && !input.probe) {
    throw new Error('PORTAL_READY_URL is required with --apply: nothing is revoked unproven');
  }
  const isPortalHook = portalHookFilter(input.portalHosts);

  // 1. The portal's environment holds the new token — not the leaked one, not a token from
  //    an earlier, abandoned run.
  const current = input.currentToken ? await whoIs(cfg.base, input.currentToken, fetchImpl) : undefined;
  if (current?.id !== input.keepTokenId) {
    throw new Error(
      `the portal's environment does not hold the new token ${input.keepTokenId} ` +
        `(it holds ${current ? current.id : 'nothing that authenticates'}); not revoking anything`,
    );
  }

  await admin.login(cfg.email, cfg.password);
  const admin_ = `/v1/admin/sites/${cfg.siteId}`;
  const listTokens = () => admin.call<ServiceToken[]>('GET', `${admin_}/service-tokens`);
  const listed = new Set(input.revokeTokenIds);

  const before = await listTokens();
  const keep = before.find((t) => t.id === input.keepTokenId);
  if (!keep || keep.revokedAt) {
    throw new Error(`the new token ${input.keepTokenId} is missing or revoked; not revoking anything`);
  }

  // 2. The running portal uses it: its last use moves when the portal is made to read Kal El.
  //    A build running at the same time also reads Kal El with the new token, so the wrapper
  //    refuses to finish while a deployment of the portal is queued or running.
  if (input.probe) {
    await input.probe();
    const after = await listTokens();
    const keptAfter = after.find((t) => t.id === input.keepTokenId);
    if (!usedAfter(keep.lastUsedAt, keptAfter?.lastUsedAt ?? null)) {
      throw new Error(
        `the running portal did not use the new token (last use ${keptAfter?.lastUsedAt ?? 'never'}); ` +
          'is the new deployment live? Not revoking anything',
      );
    }
    log(`conferido: o portal no ar usa o token novo (último uso ${keptAfter?.lastUsedAt})`);
    // A token to revoke being used during the probe means something still runs with it: an
    // old container, or whoever holds the leak. Not a refusal (the leak's holder could keep
    // it busy on purpose), but the owner reads it before typing REVOGAR.
    for (const t of before.filter((x) => listed.has(x.id) && !x.revokedAt)) {
      const now = after.find((x) => x.id === t.id);
      if (usedAfter(t.lastUsedAt, now?.lastUsedAt ?? null)) {
        log(
          `ATENÇÃO: ${t.id} "${t.name}" também foi usado durante a conferência (${now?.lastUsedAt}). ` +
            'Se um container antigo do portal ainda estiver no ar, ele cai na revogação.',
        );
      }
    }
  } else {
    log('aviso: sem PORTAL_READY_URL, não conferi se o portal no ar usa o token novo (só no dry run)');
  }

  const tokens = await listTokens();
  const webhooks = await admin.call<Webhook[]>('GET', `${admin_}/webhooks`);
  const kept = webhooks.filter((w) => input.keepWebhookIds.includes(w.id));
  if (kept.length !== input.keepWebhookIds.length) throw new Error('a new webhook is missing; not deleting anything');

  const allowed = new Set(input.allowForeignIds ?? []);
  const candidates = tokens.filter((t) => listed.has(t.id) && !t.revokedAt && t.id !== input.keepTokenId);
  const foreign = candidates.filter((t) => !t.name.startsWith(PORTAL_TOKEN_PREFIX) && !allowed.has(t.id));
  const toRevoke = candidates.filter((t) => !foreign.includes(t));
  const toDelete = webhooks.filter((w) => isPortalHook(w) && !input.keepWebhookIds.includes(w.id));

  for (const t of toRevoke) log(`a revogar: ${describeToken(t)}`);
  for (const t of foreign) log(`NÃO revogo sem confirmação (outro nome): ${describeToken(t)}`);
  for (const w of toDelete) log(`a apagar: webhook ${w.id} ${w.url}`);
  for (const t of tokens.filter((t) => !t.revokedAt && t.id !== input.keepTokenId && !candidates.includes(t))) {
    log(`mantido: ${describeToken(t)}`);
  }

  if (!cfg.apply) {
    log('dry run — nada foi escrito. Rode com --apply para aplicar.');
    return { revoked: [], deletedWebhooks: [], stillActive: [] };
  }

  const revoked: string[] = [];
  for (const t of toRevoke) {
    await admin.call('POST', `${admin_}/service-tokens/${t.id}/revoke`);
    revoked.push(t.id);
    log(`revogado: ${t.id}`);
  }
  const deletedWebhooks: string[] = [];
  for (const w of toDelete) {
    await admin.call('DELETE', `${admin_}/webhooks/${w.id}`);
    deletedWebhooks.push(w.id);
    log(`webhook apagado: ${w.id}`);
  }
  // What was asked to be revoked and is still active, read back from Kal El.
  const stillActive = (await listTokens())
    .filter((t) => listed.has(t.id) && t.id !== input.keepTokenId && !t.revokedAt)
    .map((t) => t.id);
  log(`STILL_ACTIVE_IDS=${stillActive.join(',')}`);
  return { revoked, deletedWebhooks, stillActive };
}

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const phase = argv.find((a) => !a.startsWith('--'));
  if (argv.includes('--help') || (phase !== 'prepare' && phase !== 'finish')) {
    console.log(
      'pnpm kalel:rotate <prepare|finish> [--apply] [--expires-days=N] — ver o cabeçalho de scripts/kalel-rotate.ts',
    );
    if (!argv.includes('--help')) process.exitCode = 1;
    return;
  }
  const need = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  const cfg: RotateConfig = {
    base: need('KAL_EL_BASE_URL').replace(/\/+$/, ''),
    siteId: need('KAL_EL_SITE_ID'),
    email: need('KALEL_ADMIN_EMAIL'),
    password: need('KALEL_ADMIN_PASSWORD'),
    apply: argv.includes('--apply'),
  };
  const portalHosts = list(need('PORTAL_HOSTS'));
  const log = (line: string) => console.log(line);
  const admin = new KalElAdmin(cfg.base);
  if (phase === 'prepare') {
    const days = Number(/^--expires-days=(\d+)$/.exec(argv.find((a) => a.startsWith('--expires-days=')) ?? '')?.[1]);
    const leaked = process.env.LEAKED_SERVICE_TOKEN?.trim();
    const portal = process.env.PORTAL_PUBLIC_URL?.trim();
    await prepare(
      cfg,
      {
        newWebhookSecret: need('NEW_WEBHOOK_SECRET'),
        portalHosts,
        ...(leaked ? { leakedToken: leaked } : {}),
        ...(portal ? { portal } : {}),
        ...(days > 0 ? { expiresInDays: days } : {}),
      },
      admin,
      log,
    );
    return;
  }
  const readyUrl = process.env.PORTAL_READY_URL?.trim();
  await finish(
    cfg,
    {
      keepTokenId: need('KEEP_TOKEN_ID'),
      keepWebhookIds: list(need('KEEP_WEBHOOK_IDS')),
      revokeTokenIds: list(process.env.REVOKE_TOKEN_IDS),
      currentToken: need('CURRENT_SERVICE_TOKEN'),
      portalHosts,
      allowForeignIds: list(process.env.ALLOW_FOREIGN_REVOKE_IDS),
      ...(readyUrl
        ? {
            probe: async () => {
              const url = new URL(readyUrl);
              url.searchParams.set('rotacao', String(Date.now()));
              await fetch(url, { cache: 'no-store' }).catch(() => undefined);
            },
          }
        : {}),
    },
    admin,
    log,
  );
}

runAsScript(import.meta.url, main);
