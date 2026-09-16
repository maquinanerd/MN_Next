import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { KalElAdmin } from '../kalel-provision';
import { runAsScript } from './cli';

/**
 * One production import of the WordPress archive, with everything around it that must not
 * be left to memory. Run by the operator through `scripts/acervo-import.ps1`, which asks for
 * the owner's password without echo.
 *
 *   KAL_EL_BASE_URL=… KAL_EL_SITE_ID=… KALEL_ADMIN_EMAIL=… KALEL_ADMIN_PASSWORD=… \
 *   WP_ARCHIVE_DUMP=… pnpm wp:import-session -- <flags for wp:import>
 *   pnpm wp:import-session --recover      # after an interrupted session
 *
 * In order:
 *   1. logs in as the site owner;
 *   2. pauses the site's enabled webhooks — every imported article emits a publication
 *      event, and 41 thousand revalidations would spend the portal's delivery token on
 *      the import instead of on readers; a paused subscriber receives nothing;
 *   3. mints an import token with the import scopes, expiring in 48 hours;
 *   4. runs `wp:import --source archive --apply --resume` with that token, in the child's
 *      environment only;
 *   5. runs it a second time and requires `created: 0` — the idempotency proof RUNBOOK
 *      §4.2.1 demands before anyone trusts the archive;
 *   6. always, success or not: resumes the webhooks it paused and revokes the token.
 *
 * What it paused and minted is written to a session file before the import starts, so
 * `--recover` can undo it if the window running this is closed halfway.
 */

const IMPORT_SCOPES = [
  'articles.read',
  'articles.create',
  'articles.update',
  'articles.publish',
  'articles.schedule',
  'media.read',
  'media.manage',
  'taxonomy.categories.manage',
  'taxonomy.tags.manage',
  'taxonomy.authors.manage',
  'taxonomy.entities.manage',
  'seo.manage',
];

const SESSION_FILE = 'artifacts/migration/import-session.json';
const TOKEN_HOURS = 48;

interface Webhook {
  id: string;
  url: string;
  enabled: boolean;
}

interface Session {
  startedAt: string;
  siteId: string;
  pausedWebhooks: string[];
  tokenId: string | null;
}

export interface SessionConfig {
  base: string;
  siteId: string;
  email: string;
  password: string;
}

export interface SessionDeps {
  admin: KalElAdmin;
  /** Runs `wp:import` with these flags and this token; resolves with its exit code. */
  runImport: (flags: string[], token: string) => Promise<number>;
  /** The `counts` of the report the last run wrote. */
  readCounts: () => Promise<Record<string, number>>;
  saveSession: (session: Session | null) => Promise<void>;
  loadSession: () => Promise<Session | null>;
  log: (line: string) => void;
  now?: () => Date;
}

export interface SessionResult {
  firstExit: number;
  secondExit: number | null;
  createdOnSecondRun: number | null;
}

function need(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function sessionConfig(): SessionConfig {
  return {
    base: need('KAL_EL_BASE_URL').replace(/\/+$/, ''),
    siteId: need('KAL_EL_SITE_ID'),
    email: need('KALEL_ADMIN_EMAIL'),
    password: need('KALEL_ADMIN_PASSWORD'),
  };
}

/** Undoes what a session did: resumes its webhooks and revokes its token. Safe to repeat. */
export async function undo(cfg: SessionConfig, session: Session, deps: SessionDeps): Promise<void> {
  const admin = `/v1/admin/sites/${cfg.siteId}`;
  // A fresh session: the import takes hours, and Kal El rotates and idles out the one
  // that started it.
  await deps.admin.login(cfg.email, cfg.password);
  for (const id of session.pausedWebhooks) {
    await deps.admin.call('PATCH', `${admin}/webhooks/${id}`, { enabled: true });
    deps.log(`webhook ${id} retomado`);
  }
  if (session.tokenId) {
    await deps.admin.call('POST', `${admin}/service-tokens/${session.tokenId}/revoke`);
    deps.log(`token de importação ${session.tokenId} revogado`);
  }
  await deps.saveSession(null);
}

export async function runSession(cfg: SessionConfig, flags: string[], deps: SessionDeps): Promise<SessionResult> {
  const now = deps.now ?? (() => new Date());
  const admin = `/v1/admin/sites/${cfg.siteId}`;

  const leftover = await deps.loadSession();
  if (leftover) {
    throw new Error(
      `a previous session did not finish (started ${leftover.startedAt}); run with --recover before a new import`,
    );
  }

  await deps.admin.login(cfg.email, cfg.password);
  const session: Session = { startedAt: now().toISOString(), siteId: cfg.siteId, pausedWebhooks: [], tokenId: null };

  try {
    const webhooks = await deps.admin.call<Webhook[]>('GET', `${admin}/webhooks`);
    for (const hook of webhooks.filter((w) => w.enabled)) {
      await deps.admin.call('PATCH', `${admin}/webhooks/${hook.id}`, { enabled: false });
      session.pausedWebhooks.push(hook.id);
      // Written at every step: an interruption between two calls must still be undoable.
      await deps.saveSession(session);
      deps.log(`webhook pausado: ${hook.url}`);
    }

    const expiresAt = new Date(now().getTime() + TOKEN_HOURS * 3600_000).toISOString();
    const minted = await deps.admin.call<{ id: string; token?: string; secret?: string }>(
      'POST',
      `${admin}/service-tokens`,
      { name: `maquinanerd-importacao-${session.startedAt.slice(0, 10)}`, scopes: IMPORT_SCOPES, expiresAt },
    );
    session.tokenId = minted.id;
    await deps.saveSession(session);
    const token = minted.token ?? minted.secret;
    if (!token) throw new Error('the token was created without a secret in the response');
    deps.log(`token de importação criado (expira ${expiresAt})`);

    const runFlags = ['--source', 'archive', '--apply', '--resume', ...flags];
    deps.log('1ª passada: importação');
    const firstExit = await deps.runImport(runFlags, token);
    if (firstExit !== 0) {
      deps.log(`a 1ª passada terminou com código ${firstExit}; a 2ª não roda`);
      return { firstExit, secondExit: null, createdOnSecondRun: null };
    }

    deps.log('2ª passada: prova de idempotência (created deve ser 0)');
    const secondExit = await deps.runImport(runFlags, token);
    const created = (await deps.readCounts()).created ?? null;
    deps.log(`2ª passada: código ${secondExit}, created ${String(created)}`);
    return { firstExit, secondExit, createdOnSecondRun: created };
  } finally {
    await undo(cfg, session, deps);
  }
}

function spawnImport(flags: string[], token: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['wp:import', ...flags], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      // The token reaches the importer and nothing else: not argv, not a file, not a log.
      env: { ...process.env, KAL_EL_SERVICE_TOKEN: token, KALEL_ADMIN_PASSWORD: '' },
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function outDirOf(flags: string[]): string {
  const at = flags.findIndex((f) => f === '--out' || f.startsWith('--out='));
  if (at === -1) return 'artifacts/migration';
  const flag = flags[at] ?? '';
  return flag.includes('=') ? flag.slice('--out='.length) : (flags[at + 1] ?? 'artifacts/migration');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  if (argv.includes('--help')) {
    console.log(
      'pnpm wp:import-session [--recover] -- <flags de wp:import> — ver o cabeçalho de scripts/wp/import-session.ts',
    );
    return;
  }
  const cfg = sessionConfig();
  const deps: SessionDeps = {
    admin: new KalElAdmin(cfg.base),
    runImport: spawnImport,
    readCounts: async () => {
      const report = JSON.parse(await readFile(path.join(outDirOf(argv), 'import-report.json'), 'utf8')) as {
        counts?: Record<string, number>;
      };
      return report.counts ?? {};
    },
    saveSession: async (session) => {
      if (!session) return rm(SESSION_FILE, { force: true });
      await mkdir(path.dirname(SESSION_FILE), { recursive: true });
      await writeFile(SESSION_FILE, JSON.stringify(session, null, 2), 'utf8');
    },
    loadSession: async () => {
      try {
        return JSON.parse(await readFile(SESSION_FILE, 'utf8')) as Session;
      } catch {
        return null;
      }
    },
    log: (line) => console.log(`[wp:import-session] ${line}`),
  };

  if (argv.includes('--recover')) {
    const session = await deps.loadSession();
    if (!session) {
      deps.log('nenhuma sessão pendente');
      return;
    }
    await undo(cfg, session, deps);
    return;
  }

  const result = await runSession(cfg, argv, deps);
  if (result.firstExit !== 0 || result.secondExit !== 0 || result.createdOnSecondRun !== 0) {
    throw new Error(`import session failed: ${JSON.stringify(result)}`);
  }
  deps.log('importação concluída e idempotente');
}

runAsScript(import.meta.url, main);
