import { afterEach, describe, expect, it } from 'vitest';

import robots from '../../app/robots';
import { resetEnvCache } from '../../packages/content/src/env';
import { contentRepository, setContentRepository } from '../../packages/content/src/provider';

/**
 * The two decisions a deployment makes about itself: where its content comes from, and
 * whether search engines may index it. Both were keyed off signals that a staging
 * deployment answers the same way production does.
 */

const KEYS = [
  'NODE_ENV',
  'APP_ENV',
  'CONTENT_SOURCE',
  'NEXT_PUBLIC_SITE_URL',
  'KAL_EL_BASE_URL',
  'KAL_EL_SITE_ID',
  'KAL_EL_SERVICE_TOKEN',
  'KAL_EL_WEBHOOK_SECRET',
  'KAL_EL_PREVIEW_SECRET',
  'TRUST_PROXY',
] as const;

const ORIGINAL = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

function deployAs(patch: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEnvCache();
  setContentRepository(null);
}

afterEach(() => {
  deployAs(ORIGINAL as Record<string, string | undefined>);
});

describe('the fixture provider cannot be constructed for an audience', () => {
  it('is available in a test or development deployment', () => {
    deployAs({ APP_ENV: 'test', CONTENT_SOURCE: 'fixture' });
    expect(contentRepository()).toBeTruthy();
  });

  it.each(['production', 'staging'])('refuses to build one in %s', (appEnv) => {
    deployAs({ APP_ENV: appEnv, CONTENT_SOURCE: 'fixture' });
    // Two independent guards stand behind this — the environment validator refuses the
    // combination, and the factory refuses to construct the repository even if an
    // environment were assembled some other way. From out here they are one behaviour,
    // which is the point: there is no ordering of events that yields a fixture reader.
    expect(() => contentRepository()).toThrow();
  });
});

describe('robots.txt decides from APP_ENV, not from the hostname', () => {
  const CREDENTIALS = {
    // A staging build is a production build — this is the whole reason the old rule
    // failed, so the test has to reproduce it rather than lean on the runner's default.
    NODE_ENV: 'production',
    CONTENT_SOURCE: 'kalel',
    KAL_EL_BASE_URL: 'https://cms.example.com',
    KAL_EL_SITE_ID: '3f4c5a2e-1111-4222-8333-444455556666',
    KAL_EL_SERVICE_TOKEN: 'ke_st.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    KAL_EL_WEBHOOK_SECRET: 'w'.repeat(48),
    KAL_EL_PREVIEW_SECRET: 'p'.repeat(48),
    TRUST_PROXY: 'true',
  };

  const disallowsEverything = (result: ReturnType<typeof robots>): boolean => {
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    return rules.every((r) => r.disallow === '/');
  };

  it('lets the real site be crawled', () => {
    deployAs({ ...CREDENTIALS, APP_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://www.maquinanerd.com.br' });
    const result = robots();
    expect(disallowsEverything(result)).toBe(false);
    // Both sitemaps, not just the index: the news sitemap is what Google News reads, and
    // it is the one that can vanish without any page looking broken.
    expect(result.sitemap).toEqual([
      'https://www.maquinanerd.com.br/sitemap.xml',
      'https://www.maquinanerd.com.br/news-sitemap.xml',
    ]);
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    expect(rules[0]?.disallow).toEqual(['/api/', '/preview/', '/busca', '/media/']);
  });

  it('closes a staging host whose name gives nothing away', () => {
    // The previous rule was `NODE_ENV === 'production'` plus a hostname pattern. A
    // staging build *is* a production build, and `homolog.` matched no pattern — so the
    // pre-launch deployment holding the whole archive would have been fully crawlable
    // and competing with the real site for its own content.
    deployAs({ ...CREDENTIALS, APP_ENV: 'staging', NEXT_PUBLIC_SITE_URL: 'https://homolog.maquinanerd.com.br' });
    expect(disallowsEverything(robots())).toBe(true);
  });

  it('still closes a host that only the name betrays', () => {
    deployAs({ ...CREDENTIALS, APP_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://staging.maquinanerd.com.br' });
    expect(disallowsEverything(robots())).toBe(true);
  });
});
