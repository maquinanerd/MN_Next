import type { LookupAddress, LookupOptions } from 'node:dns';
import { lookup as lookupAll } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import { Readable } from 'node:stream';

import { isLoopbackHost, isPrivateHost } from '@mn/content/security/address';

/**
 * A fetch that connects only to an address it has just checked.
 *
 * The asset guard resolves a host name and refuses private answers, but a check followed
 * by an ordinary `fetch` resolves the name twice: once for the check, once for the
 * socket. A name that answers the first with a public address and the second with
 * 169.254.169.254 — DNS rebinding — walks the fetch into the network behind it. That
 * was a documented limitation while the only hosts were the ones the operator declared.
 * With `--external-images` the hosts come out of ten years of post bodies, some on
 * domains long since expired and re-registrable, and it is not one any more.
 *
 * Here the check *is* the resolution the socket uses: Node's `http`/`https` take a
 * `lookup` function, and this one refuses a name if any of its addresses is not
 * permitted, then hands the socket exactly those addresses. A literal IP never reaches
 * it — the URL guard has judged those already, and they cannot change their answer.
 */

/** What a guarded fetch needs from an HTTP client, and nothing more. */
export type AssetFetch = (
  url: string,
  init: { redirect: 'manual'; headers?: Record<string, string>; signal: AbortSignal },
) => Promise<Response>;

/** Whether the socket for `hostname` may connect to `address`. */
export type AddressPermit = (hostname: string, address: string) => boolean;

export type Resolver = (hostname: string) => Promise<LookupAddress[]>;

/** The code of a refused connection, so a caller can tell it from a network fault. */
export const ADDRESS_REFUSED = 'ERR_IMPORTER_ADDRESS_REFUSED';

/** Public addresses only. */
export const publicOnly: AddressPermit = (_hostname, address) => !isPrivateHost(address);

/**
 * Public addresses, and loopback for a host that names this machine: the local rehearsal,
 * where `import.ts` has proved every declared endpoint is loopback. A public-looking name
 * that resolves to 127.0.0.1 is still refused.
 */
export const publicOrLoopbackName: AddressPermit = (hostname, address) =>
  !isPrivateHost(address) || (isLoopbackHost(hostname) && isLoopbackHost(address));

const resolveAll: Resolver = (hostname) => lookupAll(hostname, { all: true });

function familyOf(options: LookupOptions): 4 | 6 | null {
  if (options.family === 4 || options.family === 'IPv4') return 4;
  if (options.family === 6 || options.family === 'IPv6') return 6;
  return null;
}

function pinnedLookup(permit: AddressPermit, resolve: Resolver): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname).then(
      (addresses) => {
        // Every answer is judged, not just the one that would be used: any of them may be
        // the one a retry or the other address family connects to.
        const refused = addresses.find((entry) => !permit(hostname, entry.address));
        const family = familyOf(options);
        const usable = family === null ? addresses : addresses.filter((entry) => entry.family === family);
        const first = usable[0];
        if (refused || !first) {
          const error: NodeJS.ErrnoException = new Error(
            refused
              ? `${hostname} resolves to ${refused.address}, which this fetch may not reach`
              : `${hostname} has no usable address`,
          );
          error.code = refused ? ADDRESS_REFUSED : 'ENOTFOUND';
          callback(error, '');
          return;
        }
        if (options.all) callback(null, usable);
        else callback(null, first.address, first.family);
      },
      (err: unknown) => callback(err instanceof Error ? err : new Error(String(err)), ''),
    );
  };
}

function toResponse(incoming: IncomingMessage): Response {
  const status = incoming.statusCode ?? 502;
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  if (status === 204 || status === 205 || status === 304) {
    incoming.resume();
    return new Response(null, { status, headers });
  }
  return new Response(Readable.toWeb(incoming) as unknown as ReadableStream<Uint8Array>, { status, headers });
}

/**
 * GET without following redirects, over a socket that reaches only permitted addresses.
 *
 * Asks for an identity encoding, since nothing here decompresses: a compressed image
 * would fail the raster sniff, which is the safe way to fail.
 */
export function pinnedFetch(permit: AddressPermit, resolve: Resolver = resolveAll): AssetFetch {
  const lookup = pinnedLookup(permit, resolve);
  return (url, init) =>
    new Promise<Response>((settle, fail) => {
      const target = new URL(url);
      const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
      const request = send(
        target,
        { method: 'GET', headers: { 'accept-encoding': 'identity', ...init.headers }, lookup, signal: init.signal },
        (incoming) => {
          try {
            settle(toResponse(incoming));
          } catch (err) {
            // A status `Response` cannot represent (outside 200–599) is a broken server.
            incoming.destroy();
            fail(err);
          }
        },
      );
      request.on('error', fail);
      request.end();
    });
}
