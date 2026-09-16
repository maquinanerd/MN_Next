import { afterEach, describe, expect, it } from 'vitest';

import { resetRateLimits } from '../../lib/rate-limit';
import { SEARCH_MAX_PAGES, searchAllowed, searchPage } from '../../lib/search';

/**
 * `/busca` is the one public page whose cost the visitor picks, and every search spends the
 * delivery token's Kal El quota. These are the two ceilings on it.
 */

const ORIGINAL_TRUST_PROXY = process.env.TRUST_PROXY;

afterEach(() => {
  resetRateLimits();
  if (ORIGINAL_TRUST_PROXY === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = ORIGINAL_TRUST_PROXY;
});

describe('search result pages', () => {
  it('serves the first five', () => {
    expect(searchPage(undefined)).toBe(1);
    expect(searchPage(String(SEARCH_MAX_PAGES))).toBe(SEARCH_MAX_PAGES);
  });

  it.each([{ raw: String(SEARCH_MAX_PAGES + 1) }, { raw: '9999' }, { raw: '0' }, { raw: 'abc' }, { raw: ['2', '3'] }])(
    'is a 404 for page $raw',
    ({ raw }) => {
      expect(() => searchPage(raw)).toThrow(/404/);
    },
  );
});

describe('search rate', () => {
  // What Traefik sends: the header rewritten to the one address that connected to it.
  const from = (address?: string): Headers => new Headers(address ? { 'x-forwarded-for': address } : {});

  it('lets a client run its allowance, then refuses it for the rest of the minute', () => {
    process.env.TRUST_PROXY = 'false';
    for (let i = 0; i < 3; i += 1) expect(searchAllowed(from(), 3)).toBe(true);
    expect(searchAllowed(from(), 3)).toBe(false);
  });

  it('keys on the address the proxy wrote, so readers do not share one allowance', () => {
    process.env.TRUST_PROXY = 'true';
    expect(searchAllowed(from('203.0.113.7'), 1)).toBe(true);
    expect(searchAllowed(from('203.0.113.7'), 1)).toBe(false);
    expect(searchAllowed(from('198.51.100.9'), 1)).toBe(true);
  });

  it('ignores the header when no proxy is trusted, so a forged one mints no allowance', () => {
    process.env.TRUST_PROXY = 'false';
    expect(searchAllowed(from('203.0.113.7'), 1)).toBe(true);
    expect(searchAllowed(from('198.51.100.9'), 1)).toBe(false);
  });
});
