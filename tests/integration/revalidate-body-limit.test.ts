import { describe, expect, it } from 'vitest';

import { POST } from '../../app/api/revalidate/route';

/**
 * The webhook has to read its body to check the signature, so the size cap must hold
 * before that read — on what the sender declares — and again on what actually arrives.
 */

const ENDPOINT = 'http://127.0.0.1:3000/api/revalidate';
const LIMIT = 64 * 1024;

describe('the publication webhook body limit', () => {
  it('refuses a declared oversize body without reading a byte of it', async () => {
    let read = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          read = true;
          controller.enqueue(new TextEncoder().encode('{}'));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: { 'content-length': String(LIMIT + 1) },
      body,
      duplex: 'half',
    };

    const res = await POST(new Request(ENDPOINT, init));

    expect(res.status).toBe(413);
    expect(read).toBe(false);
  });

  it('refuses an oversize body that declared no length', async () => {
    const res = await POST(new Request(ENDPOINT, { method: 'POST', body: 'x'.repeat(LIMIT + 1) }));
    expect(res.status).toBe(413);
  });

  it('goes on to refuse an unsigned delivery of an acceptable size', async () => {
    const res = await POST(new Request(ENDPOINT, { method: 'POST', body: '{}' }));
    expect(res.status).toBe(401);
  });
});
