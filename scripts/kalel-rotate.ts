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
 *   pnpm kalel:rotate finish [--apply]    # revoke the leaked token(s), delete the old
 *                                         # webhook(s)
 *
 * Nothing is written without `--apply`. scripts/rotacionar-segredos.ps1 runs both phases
 * around the Coolify update and the deploy, and is the way to use this in production.
 *
 * Environment (never flags: an argument is visible in the process list):
 *   KAL_EL_BASE_URL, KAL_EL_SITE_ID, KALEL_ADMIN_EMAIL, KALEL_ADMIN_PASSWORD
 *   prepare  NEW_WEBHOOK_SECRET    32–128 characters, the value the portal will verify with
 *            LEAKED_SERVICE_TOKEN  optional: the token that leaked, to find its id through
 *                                  /v1/auth/me (it is never printed)
 *            PORTAL_PUBLIC_URL     only when no webhook points at /api/revalidate yet
 *   finish   KEEP_TOKEN_ID, KEEP_WEBHOOK_IDS (comma-separated), from `prepare`
 *            REVOKE_TOKEN_IDS      optional, comma-separated: the leaked token's id
 *
 * What it touches, and only that:
 *   - service tokens named `maquinanerd-portal…` plus the ids it is given — never another
 *     consumer's token (MN-Prime publishes with its own, `mn-prime-publicacao`);
 *   - webhooks whose path is `/api/revalidate` — the portal's.
 *
 * `prepare` prints, for the wrapper to capture, one `KAL_EL_SERVICE_TOKEN=` line (the new
 * secret, shown once as Kal El itself does) and the ids `finish` needs. Nothing else it
 * prints is secret.
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
  leakedToken?: string;
  portal?: string;
  /** Today, for the new token's and webhook's names. */
  now?: Date;
  expiresInDays?: number;
}

export interface PrepareResult {
  token?: { id: string; secret: string };
  webhookIds: string[];
  leakedTokenId?: string;
}

const isPortalHook = (w: Webhook): boolean => {
  try {
    return new URL(w.url).pathname.replace(/\/+$/, '') === HOOK_PATH;
  } catch {
    return false;
  }
};

function describeToken(t: ServiceToken): string {
  const state = t.revokedAt ? `revogado em ${t.revokedAt}` : 'ativo';
  return `${t.id} "${t.name}" — ${state}; criado ${t.createdAt}; último uso ${t.lastUsedAt ?? 'nunca'}`;
}

/** The id of the token behind a credential, through the endpoint that answers who is calling. */
async function tokenIdOf(base: string, token: string, fetchImpl: typeof fetch): Promise<string | undefined> {
  const res = await fetchImpl(`${base}/v1/auth/me`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return undefined;
  const me = (await res.json()) as { data?: { kind?: string; id?: string } };
  return me.data?.kind === 'service' ? me.data.id : undefined;
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
  const now = input.now ?? new Date();
  const stamp = now.toISOString().slice(0, 10);

  // Before logging in, so a wrong admin password cannot hide whether the leaked token works.
  const leakedTokenId = input.leakedToken ? await tokenIdOf(cfg.base, input.leakedToken, fetchImpl) : undefined;
  if (input.leakedToken) {
    log(
      leakedTokenId
        ? `token vazado identificado: ${leakedTokenId} (ainda ativo)`
        : 'o token vazado já não autentica (revogado, expirado ou inexistente)',
    );
  }

  await admin.login(cfg.email, cfg.password);
  const admin_ = `/v1/admin/sites/${cfg.siteId}`;
  const tokens = await admin.call<ServiceToken[]>('GET', `${admin_}/service-tokens`);
  const webhooks = await admin.call<Webhook[]>('GET', `${admin_}/webhooks`);

  log(`tokens do site (${tokens.length}):`);
  for (const t of tokens) log(`  ${describeToken(t)}`);
  const leaked = tokens.find((t) => t.id === leakedTokenId);
  if (leaked && !leaked.name.startsWith(PORTAL_TOKEN_PREFIX)) {
    log(
      `ATENÇÃO: o token vazado se chama "${leaked.name}", não ${PORTAL_TOKEN_PREFIX}…. Se outro consumidor ` +
        '(o MN-Prime) usa o mesmo token, ele também precisa de um novo depois do `finish`.',
    );
  }

  const portalHooks = webhooks.filter(isPortalHook);
  const urls = [...new Set(portalHooks.map((w) => w.url))];
  if (urls.length === 0) {
    if (!input.portal) throw new Error(`no webhook points at ${HOOK_PATH}; set PORTAL_PUBLIC_URL`);
    urls.push(`${input.portal.replace(/\/+$/, '')}${HOOK_PATH}`);
  }
  log(`webhooks do portal: ${portalHooks.map((w) => `${w.id} ${w.url}`).join(', ') || 'nenhum'}`);
  log(`a criar: 1 token "${PORTAL_TOKEN_PREFIX}-entrega-${stamp}" e ${urls.length} webhook(s) para ${urls.join(', ')}`);

  if (!cfg.apply) {
    log('dry run — nada foi escrito. Rode com --apply para aplicar.');
    return { webhookIds: [], ...(leakedTokenId ? { leakedTokenId } : {}) };
  }

  const expiresAt = input.expiresInDays
    ? new Date(now.getTime() + input.expiresInDays * 86_400_000).toISOString()
    : null;
  const created = await admin.call<{ id: string; token?: string; secret?: string }>(
    'POST',
    `${admin_}/service-tokens`,
    { name: `${PORTAL_TOKEN_PREFIX}-entrega-${stamp}`, scopes: DELIVERY_SCOPES, expiresAt },
  );
  const secret = created.token ?? created.secret;
  if (!secret) throw new Error('Kal El created the token but did not answer its secret');

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

  log(`token criado: ${created.id}`);
  // Shown once, as Kal El itself does: the wrapper stores it in Coolify and nowhere else.
  log(`KAL_EL_SERVICE_TOKEN=${secret}`);
  log(`NEW_TOKEN_ID=${created.id}`);
  log(`NEW_WEBHOOK_IDS=${webhookIds.join(',')}`);
  if (leakedTokenId) log(`LEAKED_TOKEN_ID=${leakedTokenId}`);
  return { token: { id: created.id, secret }, webhookIds, ...(leakedTokenId ? { leakedTokenId } : {}) };
}

export interface FinishInput {
  keepTokenId: string;
  keepWebhookIds: string[];
  revokeTokenIds?: string[];
}

export interface FinishResult {
  revoked: string[];
  deletedWebhooks: string[];
}

export async function finish(
  cfg: RotateConfig,
  input: FinishInput,
  admin: KalElAdmin,
  log: (line: string) => void,
): Promise<FinishResult> {
  if (!input.keepTokenId || input.keepWebhookIds.length === 0) {
    throw new Error('KEEP_TOKEN_ID and KEEP_WEBHOOK_IDS are required: run `prepare` first');
  }
  await admin.login(cfg.email, cfg.password);
  const admin_ = `/v1/admin/sites/${cfg.siteId}`;
  const tokens = await admin.call<ServiceToken[]>('GET', `${admin_}/service-tokens`);
  const webhooks = await admin.call<Webhook[]>('GET', `${admin_}/webhooks`);

  const keep = tokens.find((t) => t.id === input.keepTokenId);
  if (!keep || keep.revokedAt)
    throw new Error(`the new token ${input.keepTokenId} is missing or revoked; not revoking anything`);
  const kept = webhooks.filter((w) => input.keepWebhookIds.includes(w.id));
  if (kept.length !== input.keepWebhookIds.length) {
    throw new Error('a new webhook is missing; not deleting anything');
  }

  const explicit = new Set(input.revokeTokenIds ?? []);
  const toRevoke = tokens.filter(
    (t) => !t.revokedAt && t.id !== input.keepTokenId && (explicit.has(t.id) || t.name.startsWith(PORTAL_TOKEN_PREFIX)),
  );
  const toDelete = webhooks.filter((w) => isPortalHook(w) && !input.keepWebhookIds.includes(w.id));

  for (const t of toRevoke) log(`a revogar: ${describeToken(t)}`);
  for (const w of toDelete) log(`a apagar: webhook ${w.id} ${w.url}`);
  const untouched = tokens.filter((t) => !t.revokedAt && t.id !== input.keepTokenId && !toRevoke.includes(t));
  for (const t of untouched) log(`mantido (outro consumidor): ${describeToken(t)}`);

  if (!cfg.apply) {
    log('dry run — nada foi escrito. Rode com --apply para aplicar.');
    return { revoked: [], deletedWebhooks: [] };
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
  return { revoked, deletedWebhooks };
}

const ids = (value: string | undefined): string[] =>
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
        ...(leaked ? { leakedToken: leaked } : {}),
        ...(portal ? { portal } : {}),
        ...(days > 0 ? { expiresInDays: days } : {}),
      },
      admin,
      log,
    );
    return;
  }
  await finish(
    cfg,
    {
      keepTokenId: need('KEEP_TOKEN_ID'),
      keepWebhookIds: ids(need('KEEP_WEBHOOK_IDS')),
      revokeTokenIds: ids(process.env.REVOKE_TOKEN_IDS),
    },
    admin,
    log,
  );
}

runAsScript(import.meta.url, main);
