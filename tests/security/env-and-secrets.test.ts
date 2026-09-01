import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { EnvError, redact, validateEnv } from '../../packages/content/src/env';

/**
 * The failure this suite exists to prevent is not a crash - it is a production instance
 * quietly serving fixture data, or a service token reaching a browser.
 */

const PROD_BASE = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: 'https://www.maquinanerd.com.br',
  CONTENT_SOURCE: 'kalel',
  KAL_EL_BASE_URL: 'https://cms.example.com',
  KAL_EL_SITE_ID: '3f4c5a2e-1111-4222-8333-444455556666',
  KAL_EL_SERVICE_TOKEN: 'ke_st.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  KAL_EL_WEBHOOK_SECRET: 'w'.repeat(48),
  KAL_EL_PREVIEW_SECRET: 'p'.repeat(48),
  MEDIA_ALLOWED_HOSTS: 'images.maquinanerd.com.br',
} as NodeJS.ProcessEnv;

describe('production environment guards', () => {
  it('accepts a complete production configuration', () => {
    const env = validateEnv({ ...PROD_BASE });
    expect(env.appEnv).toBe('production');
    expect(env.CONTENT_SOURCE).toBe('kalel');
  });

  it('refuses the fixture provider in production', () => {
    expect(() => validateEnv({ ...PROD_BASE, CONTENT_SOURCE: 'fixture' })).toThrow(EnvError);
    try {
      validateEnv({ ...PROD_BASE, CONTENT_SOURCE: 'fixture' });
    } catch (err) {
      expect((err as EnvError).issues.join(' ')).toContain('CONTENT_SOURCE must be "kalel"');
    }
  });

  it('refuses plaintext http for the CMS in production', () => {
    expect(() => validateEnv({ ...PROD_BASE, KAL_EL_BASE_URL: 'http://cms.example.com' })).toThrow(EnvError);
  });

  it('refuses short webhook and preview secrets', () => {
    expect(() => validateEnv({ ...PROD_BASE, KAL_EL_WEBHOOK_SECRET: 'short' })).toThrow(EnvError);
    expect(() => validateEnv({ ...PROD_BASE, KAL_EL_PREVIEW_SECRET: 'short' })).toThrow(EnvError);
  });

  it('refuses a wildcard or private image host in production', () => {
    expect(() => validateEnv({ ...PROD_BASE, MEDIA_ALLOWED_HOSTS: '*.example.com' })).toThrow(EnvError);
    expect(() => validateEnv({ ...PROD_BASE, MEDIA_ALLOWED_HOSTS: 'localhost' })).toThrow(EnvError);
  });

  it('allows a fixture build when APP_ENV names a non-production deployment', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      APP_ENV: 'test',
      CONTENT_SOURCE: 'fixture',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    });
    expect(env.CONTENT_SOURCE).toBe('fixture');
  });

  it('applies production guards when APP_ENV is absent', () => {
    const { APP_ENV: _drop, ...withoutAppEnv } = PROD_BASE;
    expect(() => validateEnv({ ...withoutAppEnv, CONTENT_SOURCE: 'fixture' })).toThrow(EnvError);
  });

  it('requires Kal El credentials whenever CONTENT_SOURCE is kalel', () => {
    expect(() => validateEnv({ NODE_ENV: 'development', APP_ENV: 'development', CONTENT_SOURCE: 'kalel' })).toThrow(
      EnvError,
    );
  });
});

describe('redact', () => {
  it('removes a configured secret from a message', () => {
    const previous = process.env.KAL_EL_SERVICE_TOKEN;
    process.env.KAL_EL_SERVICE_TOKEN = 'ke_st.supersecretvalue0000';
    try {
      const line = redact('upstream said: Bearer ke_st.supersecretvalue0000 rejected');
      expect(line).not.toContain('supersecretvalue');
    } finally {
      if (previous === undefined) delete process.env.KAL_EL_SERVICE_TOKEN;
      else process.env.KAL_EL_SERVICE_TOKEN = previous;
    }
  });

  it('removes any bearer token, even one it has never seen', () => {
    expect(redact('authorization: Bearer abcdefghijklmnop')).toContain('[redacted]');
  });
});

/**
 * Static check: nothing under `app/` or `components/` that is a client component may
 * reach a module holding a secret. `server-only` enforces this at build time too; this
 * test makes the failure legible rather than a webpack trace.
 */
describe('client/server boundary', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  }

  const serverOnlyModules = [
    '@mn/content/env',
    '@mn/content/provider',
    '@mn/content/kalel/',
    '../lib/content',
    '../lib/logger',
  ];

  it('no "use client" module imports a server-only module', () => {
    const files = [...walk('app'), ...walk('components'), ...walk('packages/ui/src')];
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (!/^['"]use client['"]/m.test(source)) continue;
      for (const forbidden of serverOnlyModules) {
        if (source.includes(`from '${forbidden}`)) offenders.push(`${file} -> ${forbidden}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no source file hard-codes a Kal El service token prefix', () => {
    const files = [...walk('app'), ...walk('components'), ...walk('lib'), ...walk('packages')];
    const offenders = files.filter((f) => /ke_st\.[A-Za-z0-9]{8,}/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
