import { NextResponse } from 'next/server';
import { z } from 'zod';

import { clientKey, rateLimit } from '../../../lib/rate-limit';
import { logger } from '../../../lib/logger';

/**
 * RUM sink.
 *
 * Accepts only the aggregate shape the client is allowed to send: metric, value, rating,
 * template and desk. No URL, no query string, no identifier - the schema is `.strict()`,
 * so a future client change that starts sending more is rejected here rather than
 * quietly persisted.
 *
 * The measurement is emitted as a structured log line for whatever collector the
 * deployment ships logs to; there is no database, because a metrics store is an
 * operational choice, not an application one.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z
  .object({
    name: z.enum([
      'LCP',
      'INP',
      'CLS',
      'FCP',
      'TTFB',
      'FID',
      'Next.js-hydration',
      'Next.js-route-change-to-render',
      'Next.js-render',
    ]),
    value: z.number().finite().nonnegative().max(600_000),
    rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
    template: z.string().max(32),
    desk: z.string().max(64),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const limit = rateLimit(`vitals:${clientKey(request.headers)}`, 60);
  if (!limit.ok) return new NextResponse(null, { status: 429 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return new NextResponse(null, { status: 422 });

  logger.info('rum.metric', {
    metric: parsed.data.name,
    value: parsed.data.value,
    rating: parsed.data.rating ?? null,
    template: parsed.data.template,
    desk: parsed.data.desk,
  });

  // 204: the beacon is fire-and-forget and the client has nothing to do with a body.
  return new NextResponse(null, { status: 204 });
}
