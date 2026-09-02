import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { EnvError, redact, validateEnv } from '../../packages/content/src/env';
import { isLoopbackHost, isPrivateHost } from '../../packages/content/src/security/address';

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
  TRUST_PROXY: 'true',
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

  it('holds staging to the same guards, because staging serves readers too', () => {
    // The runbook opens staging to the newsroom for a week before the cutover. A week
    // spent reviewing invented articles is a week of review thrown away, so a staging
    // deployment gets production's guards — every one except the public-URL scheme,
    // since an internal staging host may legitimately be plain http.
    const staging = { ...PROD_BASE, APP_ENV: 'staging' } as NodeJS.ProcessEnv;
    expect(validateEnv(staging).appEnv).toBe('staging');

    expect(() => validateEnv({ ...staging, CONTENT_SOURCE: 'fixture' })).toThrow(EnvError);
    expect(() => validateEnv({ ...staging, KAL_EL_SERVICE_TOKEN: undefined })).toThrow(EnvError);
    expect(() => validateEnv({ ...staging, KAL_EL_WEBHOOK_SECRET: undefined })).toThrow(EnvError);
    expect(() => validateEnv({ ...staging, KAL_EL_PREVIEW_SECRET: undefined })).toThrow(EnvError);
    expect(() => validateEnv({ ...staging, TRUST_PROXY: undefined })).toThrow(EnvError);
    expect(() => validateEnv({ ...staging, KAL_EL_BASE_URL: 'http://cms.internal' })).toThrow(EnvError);
    expect(() => validateEnv({ ...staging, MEDIA_ALLOWED_HOSTS: '172.16.0.9' })).toThrow(EnvError);

    // …but a staging host reachable over plain http inside the network is fine.
    expect(validateEnv({ ...staging, NEXT_PUBLIC_SITE_URL: 'http://homolog.internal' }).appEnv).toBe('staging');
  });

  it('names the deployment in the message, so the fix is obvious', () => {
    try {
      validateEnv({ ...PROD_BASE, APP_ENV: 'staging', CONTENT_SOURCE: 'fixture' });
      throw new Error('expected a rejection');
    } catch (err) {
      expect((err as EnvError).issues.join(' ')).toContain('in staging');
    }
  });

  it('refuses every private range as an image host, not just the obvious three', () => {
    // The check used to be a regex that knew about 10., 192.168. and 127. — so
    // 172.16.0.1 and every IPv6 spelling of a private address walked straight through.
    for (const host of [
      '172.16.0.1',
      '172.31.255.255',
      '100.64.0.1',
      '169.254.169.254',
      '0.0.0.0',
      'cms.internal',
      'db.local',
      'fd00::1',
      '::ffff:7f00:1',
      // A trailing dot is a legal fully qualified name that resolves identically. Left
      // in place it stops the address pattern matching and the host reads as public.
      'localhost.',
      '127.0.0.1.',
      'cms.internal.',
    ]) {
      expect(() => validateEnv({ ...PROD_BASE, MEDIA_ALLOWED_HOSTS: host }), host).toThrow(EnvError);
    }
    // A public CDN still passes.
    expect(
      validateEnv({ ...PROD_BASE, MEDIA_ALLOWED_HOSTS: 'images.maquinanerd.com.br,cdn.example.net' }).mediaAllowedHosts,
    ).toEqual(['images.maquinanerd.com.br', 'cdn.example.net']);
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

  it('makes the operator answer the proxy question rather than defaulting', () => {
    // Both defaults are wrong in different ways: trusting x-forwarded-for without a
    // proxy lets any caller mint a private rate-limit bucket, and ignoring a real proxy
    // collapses every visitor into one bucket. Neither may be reached by omission.
    const { TRUST_PROXY: _drop, ...withoutProxy } = PROD_BASE;
    expect(() => validateEnv(withoutProxy)).toThrow(EnvError);
    expect(() => validateEnv({ ...withoutProxy, TRUST_PROXY: 'false' })).not.toThrow();
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

describe('the local-rehearsal escape hatch is actually local', () => {
  it('recognises only loopback, not every private address', () => {
    for (const host of ['127.0.0.1', '127.1.2.3', 'localhost', 'localhost.', '::1', '[::1]', '::ffff:127.0.0.1']) {
      expect(isLoopbackHost(host), host).toBe(true);
    }
    // These are private, and a --allow-private-assets check built on `isPrivateHost`
    // accepted every one of them: a Kal El on 10.0.0.5 is a real CMS on a real network,
    // and disabling the address guard there is the opposite of a local rehearsal.
    for (const host of ['10.0.0.5', '192.168.1.10', '172.16.0.1', '169.254.169.254', 'cms.internal', '8.8.8.8']) {
      expect(isLoopbackHost(host), host).toBe(false);
      expect(isPrivateHost(host) || host === '8.8.8.8', host).toBe(true);
    }
  });
});
