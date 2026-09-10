import { EDITORIA_NAMES, EDITORIA_SLUGS, LAYOUT_TAGS, type EditoriaSlug } from '@mn/content';

import { runAsScript } from './wp/cli';

/**
 * Prepares a Kal El site to serve the portal. Run once by the operator, before the first
 * deploy — never by the portal itself.
 *
 *   KAL_EL_BASE_URL=https://api.kalel.example \
 *   KAL_EL_SITE_ID=<uuid> \
 *   KALEL_ADMIN_EMAIL=... KALEL_ADMIN_PASSWORD=... \
 *   PORTAL_PUBLIC_URL=https://www.maquinanerd.com.br \
 *   KAL_EL_WEBHOOK_SECRET=<32+ chars, the same value the portal gets> \
 *   pnpm kalel:provision            # dry run: says what it would do
 *   pnpm kalel:provision --apply    # does it
 *
 * What it ensures, each step idempotent (an existing item is left alone):
 *   1. the seven editorias as categories, with the kit's slugs and names;
 *   2. the reserved layout tags (`capa-em-tela-cheia`, `oferta`) editors pick a page
 *      composition with;
 *   3. the publication webhook pointing at `/api/revalidate`, signed with the shared
 *      secret, for `article.published` and `article.updated`;
 *   4. with `--new-token`: a delivery service token with the least scopes that work —
 *      printed once, to be stored in the portal's secret store and nowhere else.
 *
 * It logs in with an owner's credentials from the environment (never flags: an argument
 * is visible in the process list). The password is never printed.
 */

const DELIVERY_SCOPES = [
  'articles.read',
  'media.read',
  // Kal El has no read-only taxonomy or redirect scope yet; these are the narrowest that
  // let the GETs through (docs/migration/KAL-EL-DISCOVERY.md, "Escopos mínimos").
  'taxonomy.categories.manage',
  'taxonomy.tags.manage',
  'taxonomy.authors.manage',
  'taxonomy.entities.manage',
  'seo.manage',
];

const RESERVED_TAGS: { slug: string; name: string }[] = [
  { slug: LAYOUT_TAGS.overlay[0] ?? 'capa-em-tela-cheia', name: 'Capa em tela cheia' },
  { slug: LAYOUT_TAGS.offer[0] ?? 'oferta', name: 'Oferta' },
];

interface Config {
  base: string;
  siteId: string;
  email: string;
  password: string;
  portal: string;
  webhookSecret: string;
  apply: boolean;
  newToken: boolean;
}

function config(argv: string[]): Config {
  const need = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  const base = need('KAL_EL_BASE_URL').replace(/\/+$/, '');
  const portal = need('PORTAL_PUBLIC_URL').replace(/\/+$/, '');
  const webhookSecret = need('KAL_EL_WEBHOOK_SECRET');
  if (webhookSecret.length < 32) throw new Error('KAL_EL_WEBHOOK_SECRET must be at least 32 characters');
  if (!/^https:\/\//.test(portal) && !argv.includes('--allow-http')) {
    throw new Error('PORTAL_PUBLIC_URL must be https (use --allow-http only for a local rehearsal)');
  }
  return {
    base,
    siteId: need('KAL_EL_SITE_ID'),
    email: need('KALEL_ADMIN_EMAIL'),
    password: need('KALEL_ADMIN_PASSWORD'),
    portal,
    webhookSecret,
    apply: argv.includes('--apply'),
    newToken: argv.includes('--new-token'),
  };
}

/** A minimal cookie-session client for the Kal El admin API. */
export class KalElAdmin {
  private cookie = '';
  private csrf = '';

  constructor(
    private readonly base: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async login(email: string, password: string): Promise<void> {
    const res = await this.fetchImpl(`${this.base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      redirect: 'manual',
    });
    if (!res.ok) throw new Error(`login failed: HTTP ${res.status}`);
    const cookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
    this.cookie = cookies
      .map((c) => c.split(';')[0])
      .filter(Boolean)
      .join('; ');
    this.csrf = /(?:^|;\s*)ke_csrf=([^;]+)/.exec(this.cookie)?.[1] ?? '';
    if (!this.cookie || !this.csrf) throw new Error('login answered without a session');
  }

  async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method,
      headers: {
        cookie: this.cookie,
        'x-kal-el-csrf': this.csrf,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
    return (JSON.parse(text) as { data: T }).data;
  }
}

export interface ProvisionPlan {
  categories: EditoriaSlug[];
  tags: string[];
  webhook: boolean;
  token: boolean;
}

export async function provision(cfg: Config, admin: KalElAdmin, log: (line: string) => void): Promise<ProvisionPlan> {
  await admin.login(cfg.email, cfg.password);
  const site = `/v1/sites/${cfg.siteId}`;

  const categories = await admin.call<{ slug: string }[]>('GET', `${site}/categories`);
  const tags = await admin.call<{ slug: string }[]>('GET', `${site}/tags`);
  const webhooks = await admin.call<{ url: string }[]>('GET', `/v1/admin/sites/${cfg.siteId}/webhooks`);

  const hookUrl = `${cfg.portal}/api/revalidate`;
  const plan: ProvisionPlan = {
    categories: EDITORIA_SLUGS.filter((slug) => !categories.some((c) => c.slug === slug)),
    tags: RESERVED_TAGS.map((t) => t.slug).filter((slug) => !tags.some((t) => t.slug === slug)),
    webhook: !webhooks.some((w) => w.url === hookUrl),
    token: cfg.newToken,
  };

  log(`editorias a criar: ${plan.categories.join(', ') || 'nenhuma'}`);
  log(`tags reservadas a criar: ${plan.tags.join(', ') || 'nenhuma'}`);
  log(`webhook ${hookUrl}: ${plan.webhook ? 'a criar' : 'já existe'}`);
  log(`token de entrega: ${plan.token ? 'a criar (--new-token)' : 'não solicitado'}`);

  if (!cfg.apply) {
    log('dry run — nada foi escrito. Rode com --apply para aplicar.');
    return plan;
  }

  for (const slug of plan.categories) {
    await admin.call('POST', `${site}/categories`, { name: EDITORIA_NAMES[slug], slug });
    log(`categoria criada: ${slug}`);
  }
  for (const tag of RESERVED_TAGS.filter((t) => plan.tags.includes(t.slug))) {
    await admin.call('POST', `${site}/tags`, tag);
    log(`tag criada: ${tag.slug}`);
  }
  if (plan.webhook) {
    await admin.call('POST', `/v1/admin/sites/${cfg.siteId}/webhooks`, {
      url: hookUrl,
      events: ['article.published', 'article.updated'],
      description: 'Máquina Nerd — revalidação do portal',
      secret: cfg.webhookSecret,
    });
    log('webhook criado');
  }
  if (plan.token) {
    const token = await admin.call<{ token?: string; secret?: string }>(
      'POST',
      `/v1/admin/sites/${cfg.siteId}/service-tokens`,
      {
        name: 'maquinanerd-portal-entrega',
        scopes: DELIVERY_SCOPES,
      },
    );
    // Shown once, as Kal El itself does. Store it as KAL_EL_SERVICE_TOKEN and nowhere else.
    log(`KAL_EL_SERVICE_TOKEN=${token.token ?? token.secret ?? '(a resposta não trouxe o segredo)'}`);
  }
  return plan;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    console.log(
      'pnpm kalel:provision [--apply] [--new-token] [--allow-http] — ver o cabeçalho de scripts/kalel-provision.ts',
    );
    return;
  }
  const cfg = config(argv);
  await provision(cfg, new KalElAdmin(cfg.base), (line) => console.log(line));
}

runAsScript(import.meta.url, main);
