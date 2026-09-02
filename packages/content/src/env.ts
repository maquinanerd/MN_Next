import 'server-only';
import { z } from 'zod';

import { isPrivateHost } from './security/address';

/**
 * Server environment contract.
 *
 * Two properties this module exists to guarantee:
 *
 *  1. `CONTENT_SOURCE=fixture` is refused wherever the deployment serves people —
 *     production *and* staging. A fixture provider silently serving a live site is worse
 *     than an outage: it looks fine and is entirely wrong. Staging counts because the
 *     runbook opens it to the newsroom for a week before the cutover, and a week spent
 *     reviewing invented articles is a week of review thrown away.
 *  2. No secret is ever read outside this module, and nothing here is exported to the
 *     client bundle. `server-only` makes an accidental client import a build error.
 *
 * Validation is lazy and cached. Importing this file must not throw at module load, or a
 * missing optional secret would take the whole build down (the charter forbids that).
 */

const nonEmpty = z.string().trim().min(1);

const urlNoTrailingSlash = z
  .string()
  .trim()
  .url()
  .transform((u) => u.replace(/\/+$/, ''));

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /**
   * Deployment environment, which is not the same thing as `NODE_ENV`.
   *
   * `next build` always sets `NODE_ENV=production`, so keying the production guards off
   * it would make a fixture-mode build - the one CI needs for the visual audit -
   * impossible. `APP_ENV` names the *deployment* instead, and defaults to `NODE_ENV`, so
   * a real production deploy that never sets it still gets every guard. Serving readers
   * from fixtures therefore requires an explicit, visible `APP_ENV` downgrade.
   */
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).optional(),
  NEXT_PUBLIC_SITE_URL: urlNoTrailingSlash.default('http://localhost:3000'),
  CONTENT_SOURCE: z.enum(['kalel', 'fixture']).default('fixture'),

  KAL_EL_BASE_URL: urlNoTrailingSlash.optional(),
  KAL_EL_SITE_ID: z.string().uuid().optional(),
  KAL_EL_SERVICE_TOKEN: nonEmpty.optional(),
  KAL_EL_WEBHOOK_SECRET: nonEmpty.optional(),
  KAL_EL_PREVIEW_SECRET: nonEmpty.optional(),
  KAL_EL_TIMEOUT_MS: z.coerce.number().int().positive().max(30_000).default(5_000),

  CINERIE_INTERNAL_URL: urlNoTrailingSlash.optional(),
  CINERIE_SERVICE_TOKEN: nonEmpty.optional(),

  MEDIA_ALLOWED_HOSTS: z.string().default(''),

  REVALIDATE_MAX_SKEW_SECONDS: z.coerce.number().int().positive().max(3600).default(300),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info'),

  /** Public search / revalidate rate limiting, per IP per minute. */
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  /**
   * Whether a reverse proxy sits in front and `x-forwarded-for` may be trusted.
   *
   * Required explicitly in production because both answers are dangerous by default: an
   * untrusted header lets any caller mint a private rate-limit bucket per request, while
   * ignoring a real proxy collapses every visitor into one bucket and throttles the site
   * to a trickle. Neither should be reached by omission.
   */
  TRUST_PROXY: z.enum(['true', 'false']).optional(),
});

export type ServerEnv = z.infer<typeof baseSchema> & {
  mediaAllowedHosts: string[];
  /** Resolved deployment environment: `APP_ENV`, falling back to `NODE_ENV`. */
  appEnv: 'development' | 'test' | 'staging' | 'production';
};

export class EnvError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment:\n- ${issues.join('\n- ')}`);
    this.name = 'EnvError';
  }
}

function build(raw: NodeJS.ProcessEnv): ServerEnv {
  const parsed = baseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new EnvError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  const env = parsed.data;
  const issues: string[] = [];
  const appEnv = env.APP_ENV ?? env.NODE_ENV;
  // Both of these serve pages to real people, so both get the same guards. Only the
  // public URL is allowed to differ: a staging host may legitimately be reached over
  // plain http inside a network, while the credential that reaches the CMS may not.
  const servesReaders = appEnv === 'production' || appEnv === 'staging';
  const where = appEnv;

  if (servesReaders) {
    if (env.CONTENT_SOURCE !== 'kalel') {
      issues.push(`CONTENT_SOURCE must be "kalel" in ${where} - the fixture provider must never serve readers`);
    }
    if (!env.KAL_EL_BASE_URL) issues.push(`KAL_EL_BASE_URL is required in ${where}`);
    if (env.KAL_EL_BASE_URL && !env.KAL_EL_BASE_URL.startsWith('https://')) {
      // The service token travels to this host on every read. Plaintext is a leak
      // wherever it happens, so this one is not relaxed for staging.
      issues.push(`KAL_EL_BASE_URL must be https in ${where} - the service token travels to it`);
    }
    if (!env.KAL_EL_SITE_ID) issues.push(`KAL_EL_SITE_ID is required in ${where}`);
    if (!env.KAL_EL_SERVICE_TOKEN) issues.push(`KAL_EL_SERVICE_TOKEN is required in ${where}`);
    if (!env.KAL_EL_WEBHOOK_SECRET) issues.push(`KAL_EL_WEBHOOK_SECRET is required in ${where}`);
    if (env.KAL_EL_WEBHOOK_SECRET && env.KAL_EL_WEBHOOK_SECRET.length < 32) {
      issues.push('KAL_EL_WEBHOOK_SECRET must be at least 32 characters');
    }
    if (!env.KAL_EL_PREVIEW_SECRET) issues.push(`KAL_EL_PREVIEW_SECRET is required in ${where}`);
    if (env.KAL_EL_PREVIEW_SECRET && env.KAL_EL_PREVIEW_SECRET.length < 32) {
      issues.push('KAL_EL_PREVIEW_SECRET must be at least 32 characters');
    }
    if (env.TRUST_PROXY === undefined) {
      issues.push(
        `TRUST_PROXY must be set explicitly in ${where} ("true" behind a reverse proxy, "false" otherwise) - ` +
          'rate limiting buckets on the client address and both defaults fail badly',
      );
    }
  }

  if (appEnv === 'production' && !env.NEXT_PUBLIC_SITE_URL.startsWith('https://')) {
    issues.push('NEXT_PUBLIC_SITE_URL must be https in production');
  }

  if (env.CONTENT_SOURCE === 'kalel') {
    if (!env.KAL_EL_BASE_URL) issues.push('CONTENT_SOURCE=kalel requires KAL_EL_BASE_URL');
    if (!env.KAL_EL_SITE_ID) issues.push('CONTENT_SOURCE=kalel requires KAL_EL_SITE_ID');
    if (!env.KAL_EL_SERVICE_TOKEN) issues.push('CONTENT_SOURCE=kalel requires KAL_EL_SERVICE_TOKEN');
  }

  const mediaAllowedHosts = env.MEDIA_ALLOWED_HOSTS.split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  if (servesReaders) {
    for (const host of mediaAllowedHosts) {
      if (host.includes('*')) {
        issues.push(`MEDIA_ALLOWED_HOSTS entry "${host}" contains a wildcard; list explicit hosts`);
      }
      // Shared with the importer rather than re-derived here: the copy that used to
      // live in this file accepted 172.16.0.1 and every IPv6 spelling.
      if (isPrivateHost(host)) {
        issues.push(`MEDIA_ALLOWED_HOSTS entry "${host}" is a private or local address`);
      }
    }
  }

  if (issues.length > 0) throw new EnvError(issues);

  return { ...env, mediaAllowedHosts, appEnv };
}

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  cached = build(process.env);
  return cached;
}

/** Test seam: revalidate an arbitrary environment without touching the cache. */
export function validateEnv(raw: NodeJS.ProcessEnv): ServerEnv {
  return build(raw);
}

/** Test seam only. */
export function resetEnvCache(): void {
  cached = null;
}

const SECRET_KEYS = [
  'KAL_EL_SERVICE_TOKEN',
  'KAL_EL_WEBHOOK_SECRET',
  'KAL_EL_PREVIEW_SECRET',
  'CINERIE_SERVICE_TOKEN',
  'WP_APPLICATION_PASSWORD',
];

/**
 * Removes known secret values from a string before it reaches a log line.
 *
 * Belt and braces: nothing should put a token in a message in the first place, but an
 * upstream error string that echoes a request header would otherwise print it.
 */
export function redact(text: string): string {
  let out = text;
  for (const key of SECRET_KEYS) {
    const value = process.env[key];
    if (value && value.length >= 8) out = out.split(value).join(`[redacted:${key}]`);
  }
  return out.replace(/(Bearer\s+)[A-Za-z0-9._~+/-]{8,}=*/gi, '$1[redacted]');
}
