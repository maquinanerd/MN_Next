/**
 * Whether a host names something inside the network.
 *
 * No `server-only` here on purpose: this is pure classification with no secret and no
 * I/O, and the WordPress importer — a plain `tsx` script, not a server module — has to
 * use the same judgement the runtime does. Two copies of this logic is how one of them
 * ends up weaker; that already happened once, with the environment validator accepting
 * `172.16.0.1` because its regex only knew about `10.` and `192.168.`.
 *
 * The rule everywhere: a host is refused unless it is demonstrably outside the private,
 * loopback, link-local and carrier-NAT ranges. Anything unparseable is refused too — an
 * address nobody can classify is not one to connect to.
 */

/** Hostnames that never leave the machine or the local network, whatever DNS says. */
const LOCAL_SUFFIXES = ['.localhost', '.internal', '.local', '.home.arpa'];

export function isPrivateHost(host: string): boolean {
  // The trailing dot of a fully qualified name is legal and resolves identically, so
  // `localhost.` and `127.0.0.1.` are the same destinations as their bare spellings.
  // Left in place they slip past every check below — the v4 pattern stops matching and
  // the name comparison misses — and the host is read as public.
  const name = host.trim().toLowerCase().replace(/\.+$/, '');
  if (name === '') return true;
  if (name === 'localhost' || LOCAL_SUFFIXES.some((s) => name.endsWith(s))) return true;

  const bare = name.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (bare.includes(':')) return isPrivateIpv6(bare);

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bare);
  if (!v4) return false; // a name, not an address: DNS decides, not this function
  const octets = [Number(v4[1]), Number(v4[2]), Number(v4[3]), Number(v4[4])];
  if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return true;

  const [a = 0, b = 0] = octets;
  if (a === 0 || a === 10 || a === 127) return true; // this host, private, loopback
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link local, incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/**
 * Whether a host is this machine and nothing else.
 *
 * Narrower than `isPrivateHost` on purpose, and the difference matters: `10.0.0.5` is
 * private, but it is also a real service on a real network. Anything that relaxes a
 * safety check "because this is only a local rehearsal" has to mean *local*, or it
 * relaxes the check exactly where the check was protecting something.
 */
export function isLoopbackHost(host: string): boolean {
  const name = host.trim().toLowerCase().replace(/\.+$/, '');
  if (name === 'localhost' || name.endsWith('.localhost')) return true;

  const bare = name.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (bare.includes(':')) {
    const parts = expandIpv6(bare);
    if (!parts) return false;
    // ::1, and the IPv4-embedding prefixes carrying 127.x.
    const [, , , , , , g = 0, h = 0] = parts;
    if (parts.slice(0, 7).every((p) => p === 0) && h === 1) return true;
    const embeds = [
      [0, 0, 0, 0, 0, 0xffff],
      [0, 0, 0, 0, 0xffff, 0],
      [0, 0, 0, 0, 0, 0],
    ].some((prefix) => prefix.every((group, i) => parts[i] === group));
    return embeds && g >> 8 === 127;
  }

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bare);
  return v4?.[1] === '127';
}

/**
 * IPv6, parsed rather than pattern-matched.
 *
 * `::ffff:10.0.0.1` and `::ffff:a00:1` are the same address written two ways, and a
 * check that only recognises the dotted spelling reads the hex one as public — which is
 * precisely how an internal service gets reached through a guard that looks like it
 * works.
 */
function isPrivateIpv6(address: string): boolean {
  const parts = expandIpv6(address);
  if (!parts) return true;

  const [h0 = 0] = parts;
  // Every /96 that carries an IPv4 address in its last two groups. Each is a different
  // spelling of the same destination, so all of them have to be judged as IPv4.
  const embedsV4 = [
    [0, 0, 0, 0, 0, 0xffff], // ::ffff:a.b.c.d     IPv4-mapped
    [0, 0, 0, 0, 0xffff, 0], // ::ffff:0:a.b.c.d   IPv4-translated (RFC 6145)
    [0, 0, 0, 0, 0, 0], //      ::a.b.c.d          IPv4-compatible, deprecated
    [0x64, 0xff9b, 0, 0, 0, 0], // 64:ff9b::/96    NAT64 well-known prefix
  ].some((prefix) => prefix.every((group, i) => parts[i] === group));

  if (embedsV4) {
    const [, , , , , , g = 0, h = 0] = parts;
    if (g === 0 && h === 0) return true; // ::
    if (g === 0 && h === 1) return true; // ::1
    return isPrivateHost([g >> 8, g & 0xff, h >> 8, h & 0xff].join('.'));
  }

  if ((h0 & 0xfe00) === 0xfc00) return true; // fc00::/7  unique local
  if ((h0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((h0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site local, deprecated
  if ((h0 & 0xff00) === 0xff00) return true; // ff00::/8  multicast
  return false;
}

/** An IPv6 address as its eight 16-bit groups, or null if it is not one. */
export function expandIpv6(address: string): number[] | null {
  let text = address.toLowerCase();

  // A trailing dotted quad is four more hex digits.
  const dotted = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(text);
  if (dotted?.[1]) {
    const octets = dotted[1].split('.').map(Number);
    if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
    const [a = 0, b = 0, c = 0, d = 0] = octets;
    text = text.slice(0, dotted.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const groups: number[] = [];
    for (const group of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
      groups.push(parseInt(group, 16));
    }
    return groups;
  };

  const head = toGroups(halves[0] ?? '');
  const tail = halves.length === 2 ? toGroups(halves[1] ?? '') : [];
  if (!head || !tail) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;
  const gap = 8 - head.length - tail.length;
  if (gap < 1) return null;
  return [...head, ...Array<number>(gap).fill(0), ...tail];
}
