import { afterEach, describe, expect, it } from 'vitest';

import { addressKey, isCloudflare, parseAddress } from '../../lib/client-address';
import { clientKey } from '../../lib/rate-limit';

/**
 * In production the portal sits behind Cloudflare and Coolify's Traefik. The rate limits must
 * count readers, not the edge servers they arrive through, and nothing a caller writes may
 * pick the bucket. Measured on 2026-09-16 before this key existed: six requests through
 * Cloudflare never met the limit of five, because they arrived from different edge addresses.
 */

const ORIGINAL_TRUST_PROXY = process.env.TRUST_PROXY;

afterEach(() => {
  if (ORIGINAL_TRUST_PROXY === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = ORIGINAL_TRUST_PROXY;
});

/** Inside 162.158.0.0/15 and 2400:cb00::/32. */
const EDGE_V4 = '162.158.90.12';
const EDGE_V6 = '2400:cb00:2049:1::a29f:1804';

const key = (raw: string): string => {
  const address = parseAddress(raw);
  if (!address) throw new Error(`${raw} does not parse`);
  return addressKey(address);
};

const via = (headers: Record<string, string>): Headers => new Headers(headers);

describe('parseAddress', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    [' 203.0.113.7 ', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['2804:14c:65:8000::1', '2804:14c:65:8000::/64'],
    ['2804:014C:0065:8000:0000:0000:0000:0001', '2804:14c:65:8000::/64'],
    ['2804::', '2804:0:0:0::/64'],
  ])('reads %j as %s', (raw, expected) => {
    expect(key(raw)).toBe(expected);
  });

  it.each([
    '',
    'unknown',
    '203.0.113',
    '203.0.113.256',
    '203.0.113.7:443',
    '1::2::3',
    '12345::1',
    '1:2:3:4:5:6:7:8:9',
    '1:2:3:4:5:6:7',
    '[2001:db8::1]',
    'fe80::1%eth0',
  ])('refuses %j', (raw) => {
    expect(parseAddress(raw)).toBeNull();
  });
});

describe('isCloudflare', () => {
  it.each([
    ['173.245.48.0', true],
    ['104.16.0.0', true],
    ['104.27.255.255', true],
    ['104.28.0.1', false],
    ['162.159.255.255', true],
    ['162.160.0.0', false],
    ['::ffff:162.158.90.12', true],
    [EDGE_V6, true],
    ['2a06:98c7:ffff::1', true],
    ['2a06:98c8::1', false],
    ['203.0.113.7', false],
  ])('%s → %s', (raw, expected) => {
    const address = parseAddress(raw);
    expect(address).not.toBeNull();
    if (address) expect(isCloudflare(address)).toBe(expected);
  });
});

describe('clientKey behind a trusted proxy', () => {
  it('keys on the entry the proxy wrote, the last one', () => {
    process.env.TRUST_PROXY = 'true';
    expect(clientKey(via({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
    // A proxy that keeps what it received puts the caller's own words first.
    expect(clientKey(via({ 'x-forwarded-for': '198.51.100.1, 203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientKey(via({ 'x-real-ip': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('keys a reader arriving through Cloudflare on CF-Connecting-IP, whichever edge carried the request', () => {
    process.env.TRUST_PROXY = 'true';
    expect(clientKey(via({ 'x-forwarded-for': EDGE_V4, 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientKey(via({ 'x-forwarded-for': EDGE_V6, 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientKey(via({ 'x-forwarded-for': EDGE_V4, 'cf-connecting-ip': '198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('ignores CF-Connecting-IP unless Cloudflare connected, since the origin is reachable around it', () => {
    process.env.TRUST_PROXY = 'true';
    expect(clientKey(via({ 'x-forwarded-for': '203.0.113.7', 'cf-connecting-ip': '198.51.100.9' }))).toBe(
      '203.0.113.7',
    );
    // A Cloudflare address forged ahead of the proxy's own entry changes nothing.
    expect(clientKey(via({ 'x-forwarded-for': `${EDGE_V4}, 203.0.113.7`, 'cf-connecting-ip': '198.51.100.9' }))).toBe(
      '203.0.113.7',
    );
  });

  it('gives an IPv6 reader one bucket for its /64', () => {
    process.env.TRUST_PROXY = 'true';
    const reader = (address: string): string =>
      clientKey(via({ 'x-forwarded-for': EDGE_V4, 'cf-connecting-ip': address }));
    expect(reader('2804:14c:65:8000::1')).toBe(reader('2804:14c:65:8000:ffff:ffff:ffff:fffe'));
    expect(reader('2804:14c:65:8001::1')).not.toBe(reader('2804:14c:65:8000::1'));
  });

  it('shares a bucket when no address parses, throttling too much rather than too little', () => {
    process.env.TRUST_PROXY = 'true';
    expect(clientKey(via({}))).toBe('anonymous');
    expect(clientKey(via({ 'x-forwarded-for': 'unknown' }))).toBe('anonymous');
    expect(clientKey(via({ 'x-forwarded-for': EDGE_V4, 'cf-connecting-ip': 'unknown' }))).toBe(EDGE_V4);
  });

  it('reads none of it without TRUST_PROXY', () => {
    process.env.TRUST_PROXY = 'false';
    expect(clientKey(via({ 'x-forwarded-for': EDGE_V4, 'cf-connecting-ip': '203.0.113.7' }))).toBe('anonymous');
  });
});
