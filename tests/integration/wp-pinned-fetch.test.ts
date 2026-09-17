import type { LookupAddress } from 'node:dns';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ADDRESS_REFUSED,
  pinnedFetch,
  publicOnly,
  publicOrLoopbackName,
  type Resolver,
} from '../../scripts/wp/pinned-fetch';
import { fetchGuarded } from '../../scripts/wp/source';

/**
 * DNS rebinding, closed at the socket.
 *
 * The asset guard resolves a name and refuses private answers; an ordinary fetch then
 * resolves the name again to connect. A hostile name answers the check with a public
 * address and the connection with an internal one. These cases run a real HTTP server on
 * this machine and let a fake resolver play that name: the server must never be reached
 * unless the address the socket uses was itself permitted.
 */

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

let server: Server;
let port = 0;
const hits: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    hits.push(req.url ?? '');
    if (req.url === '/redirect') {
      res.writeHead(302, { location: '/ok.jpg' });
      return res.end();
    }
    if (req.url === '/big.jpg') {
      res.writeHead(200, { 'content-type': 'image/jpeg' });
      return res.end(Buffer.alloc(64 * 1024, 0xff));
    }
    res.writeHead(200, { 'content-type': 'image/jpeg', 'x-seen-encoding': String(req.headers['accept-encoding']) });
    res.end(JPEG);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** A name server that answers every name with these addresses. */
const answering =
  (...addresses: string[]): Resolver =>
  async () =>
    addresses.map((address): LookupAddress => ({ address, family: address.includes(':') ? 6 : 4 }));

const init = (): { redirect: 'manual'; signal: AbortSignal } => ({
  redirect: 'manual',
  signal: AbortSignal.timeout(5000),
});

describe('the socket reaches only an address that was permitted', () => {
  it('refuses a public-looking name that resolves to this machine, without connecting', async () => {
    const before = hits.length;
    const get = pinnedFetch(publicOnly, answering('127.0.0.1'));
    await expect(get(`http://rebind.test:${port}/ok.jpg`, init())).rejects.toMatchObject({ code: ADDRESS_REFUSED });
    expect(hits.length).toBe(before);
  });

  it('judges every answer, not only the first', async () => {
    const before = hits.length;
    const get = pinnedFetch(publicOnly, answering('203.0.113.10', '127.0.0.1'));
    await expect(get(`http://mixed.test:${port}/ok.jpg`, init())).rejects.toMatchObject({ code: ADDRESS_REFUSED });
    expect(hits.length).toBe(before);
  });

  it('reports a refusal at connection time as a refused address, not as a network fault', async () => {
    const before = hits.length;
    // The URL guard is relaxed here so that the only thing standing between the fetch and
    // this machine is the pinned socket: exactly the case of a name that passed the early
    // check and changed its answer before the connection.
    const result = await fetchGuarded(`http://rebind.test:${port}/ok.jpg`, {
      allowedHosts: new Set(['rebind.test']),
      maxBytes: 1024,
      allowPrivateHosts: true,
      fetchImpl: pinnedFetch(publicOnly, answering('10.0.0.5')),
      lookupImpl: async () => ['203.0.113.10'],
    });
    expect(result).toMatchObject({ ok: false, reason: 'not allowed: private address' });
    expect(hits.length).toBe(before);
  });
});

describe('the local rehearsal reaches this machine by its own name, and nothing else', () => {
  it('fetches from localhost, identity-encoded, with status, headers and bytes intact', async () => {
    const get = pinnedFetch(publicOrLoopbackName, answering('127.0.0.1'));
    const res = await get(`http://localhost:${port}/ok.jpg`, init());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('x-seen-encoding')).toBe('identity');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(JPEG);
  });

  it('still refuses another name that resolves to this machine', async () => {
    const before = hits.length;
    const get = pinnedFetch(publicOrLoopbackName, answering('127.0.0.1'));
    await expect(get(`http://not-localhost.test:${port}/ok.jpg`, init())).rejects.toMatchObject({
      code: ADDRESS_REFUSED,
    });
    expect(hits.length).toBe(before);
  });

  it('does not follow a redirect by itself', async () => {
    const res = await pinnedFetch(publicOrLoopbackName, answering('127.0.0.1'))(
      `http://localhost:${port}/redirect`,
      init(),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/ok.jpg');
  });

  it('works under the guard: redirects re-checked hop by hop, and the byte cap enforced', async () => {
    const guarded = (path: string) =>
      fetchGuarded(`http://localhost:${port}${path}`, {
        allowedHosts: new Set(['localhost']),
        maxBytes: 1024,
        allowLoopbackHosts: true,
        fetchImpl: pinnedFetch(publicOrLoopbackName, answering('127.0.0.1')),
        lookupImpl: async () => ['127.0.0.1'],
      });
    const followed = await guarded('/redirect');
    expect(followed.ok).toBe(true);
    expect(await guarded('/big.jpg')).toMatchObject({ ok: false, reason: 'too large' });
  });
});
