import { NextResponse } from 'next/server';
import { z } from 'zod';

import { clientKey, rateLimit } from '../../../lib/rate-limit';
import { correlationId, logger } from '../../../lib/logger';

/**
 * Newsletter sign-up.
 *
 * No provider is wired yet - the ESP has not been chosen - so this endpoint validates,
 * rate-limits and records the intent, and reports honestly. It deliberately does not
 * pretend to have subscribed anyone: the client shows "confirme na sua caixa de entrada"
 * only on a 202, and this returns 501 while no provider is configured, which the form
 * surfaces as a real error rather than a silent black hole.
 *
 * The address is never logged. `newsletter.accepted` records that one happened, not who.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().email().max(254),
});

export async function POST(request: Request): Promise<Response> {
  const cid = correlationId(request.headers);
  const limit = rateLimit(`newsletter:${clientKey(request.headers)}`, 5);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'too many requests' },
      { status: 429, headers: { 'retry-after': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'informe um e-mail válido' }, { status: 422 });
  }

  const provider = process.env.NEWSLETTER_PROVIDER_URL;
  if (!provider) {
    logger.warn('newsletter.no-provider', { correlationId: cid });
    return NextResponse.json(
      { error: 'inscrição indisponível no momento' },
      { status: 501, headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    const res = await fetch(provider, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.NEWSLETTER_PROVIDER_TOKEN
          ? { authorization: `Bearer ${process.env.NEWSLETTER_PROVIDER_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ email: parsed.data.email, source: 'maquinanerd' }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`provider responded ${res.status}`);
  } catch (err) {
    logger.error('newsletter.provider-failed', { correlationId: cid, error: String(err) });
    return NextResponse.json({ error: 'não foi possível concluir a inscrição' }, { status: 502 });
  }

  logger.info('newsletter.accepted', { correlationId: cid });
  return NextResponse.json({ data: { accepted: true } }, { status: 202, headers: { 'cache-control': 'no-store' } });
}
