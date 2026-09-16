import 'server-only';

/**
 * The reader's address behind the proxies, for rate-limit buckets.
 *
 * `TRUST_PROXY=true` means exactly one reverse proxy sits in front of the container — Traefik,
 * on Coolify — and that proxy *appends* the address that connected to it to
 * `X-Forwarded-For`. The last entry is the only one no caller can write: Traefik, in its
 * default, drops what the caller sent, and a proxy that keeps it still puts its own entry
 * after the caller's.
 *
 * Behind Cloudflare that last entry is an edge server shared by every reader routed through
 * it, and the reader is in `CF-Connecting-IP`, which Cloudflare writes itself. That header is
 * believed only when the connecting address is in Cloudflare's published ranges: the origin
 * is reachable around Cloudflare, and from anywhere else the header is the caller's own words.
 *
 * An IPv6 reader is bucketed by its /64. A subscriber line gets the whole prefix, and keying
 * on the full address would hand one reader 2^64 allowances.
 */

export interface Address {
  readonly version: 4 | 6;
  readonly value: bigint;
}

interface Range extends Address {
  readonly prefix: number;
}

/**
 * https://www.cloudflare.com/ips/, checked on 2026-09-16. A range Cloudflare adds later fails
 * safe: its readers share the edge's bucket, which throttles too much rather than too little.
 */
const CLOUDFLARE_CIDRS = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
] as const;

const IPV4_PART = /^\d{1,3}$/;
const IPV6_GROUP = /^[0-9a-f]{1,4}$/i;

function parseIPv4(text: string): bigint | null {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    if (!IPV4_PART.test(part) || Number(part) > 255) return null;
    value = (value << 8n) | BigInt(part);
  }
  return value;
}

/** The 16-bit groups of one side of `::`. Only the last group of the address may be dotted IPv4. */
function parseGroups(text: string, endsAddress: boolean): number[] | null {
  if (text === '') return [];
  const pieces = text.split(':');
  const groups: number[] = [];
  for (const [index, piece] of pieces.entries()) {
    if (endsAddress && index === pieces.length - 1 && piece.includes('.')) {
      const embedded = parseIPv4(piece);
      if (embedded === null) return null;
      groups.push(Number(embedded >> 16n), Number(embedded & 0xffffn));
    } else if (IPV6_GROUP.test(piece)) {
      groups.push(Number.parseInt(piece, 16));
    } else {
      return null;
    }
  }
  return groups;
}

function parseIPv6(text: string): bigint | null {
  const sides = text.split('::');
  if (sides.length > 2) return null;
  const compressed = sides.length === 2;
  const head = parseGroups(sides[0] ?? '', !compressed);
  const tail = compressed ? parseGroups(sides[1] ?? '', true) : [];
  if (!head || !tail) return null;
  const zeros = 8 - head.length - tail.length;
  if (compressed ? zeros < 1 : zeros !== 0) return null;
  return [...head, ...new Array<number>(zeros).fill(0), ...tail].reduce(
    (value, group) => (value << 16n) | BigInt(group),
    0n,
  );
}

/** A bare IPv4 or IPv6 address, as proxies write them: no port, brackets or zone. */
export function parseAddress(raw: string | null | undefined): Address | null {
  const text = raw?.trim();
  if (!text) return null;
  if (!text.includes(':')) {
    const value = parseIPv4(text);
    return value === null ? null : { version: 4, value };
  }
  const value = parseIPv6(text);
  if (value === null) return null;
  // ::ffff:a.b.c.d is an IPv4 reader seen through a dual-stack socket.
  if (value >> 32n === 0xffffn) return { version: 4, value: value & 0xffffffffn };
  return { version: 6, value };
}

const width = (version: 4 | 6): bigint => (version === 4 ? 32n : 128n);

function parseRange(cidr: string): Range {
  const [text, bits] = cidr.split('/');
  const address = parseAddress(text);
  const prefix = Number(bits);
  if (!address || !Number.isInteger(prefix) || prefix < 0 || BigInt(prefix) > width(address.version)) {
    throw new Error(`invalid CIDR ${cidr}`);
  }
  return { ...address, prefix };
}

const CLOUDFLARE = CLOUDFLARE_CIDRS.map(parseRange);

export function isCloudflare(address: Address): boolean {
  return CLOUDFLARE.some((range) => {
    if (range.version !== address.version) return false;
    const host = width(address.version) - BigInt(range.prefix);
    return range.value >> host === address.value >> host;
  });
}

/** The bucket an address counts against: the address itself for IPv4, its /64 for IPv6. */
export function addressKey(address: Address): string {
  if (address.version === 4) {
    return [24n, 16n, 8n, 0n].map((shift) => (address.value >> shift) & 0xffn).join('.');
  }
  const network = address.value >> 64n;
  return `${[48n, 32n, 16n, 0n].map((shift) => ((network >> shift) & 0xffffn).toString(16)).join(':')}::/64`;
}

/**
 * The reader's bucket behind a trusted proxy, or null when the headers name no address that
 * parses — the caller decides what an unknown reader shares.
 */
export function readerKey(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  const peer = parseAddress(forwarded === null ? headers.get('x-real-ip') : forwarded.split(',').at(-1));
  if (!peer) return null;
  if (isCloudflare(peer)) {
    const reader = parseAddress(headers.get('cf-connecting-ip'));
    if (reader) return addressKey(reader);
  }
  return addressKey(peer);
}
