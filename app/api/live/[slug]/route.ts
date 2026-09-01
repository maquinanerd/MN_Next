import { NextResponse } from 'next/server';
import { safeSlugParam } from '@mn/content';

import { repo } from '../../../../lib/content';
import { clientKey, rateLimit } from '../../../../lib/rate-limit';

/**
 * Live coverage entries, polled by `<LiveCoverage />`.
 *
 * Short-lived shared cache rather than `no-store`: every reader of a live blog wants the
 * same bytes, so a 15-second window collapses thousands of polls into one CMS read while
 * keeping the coverage effectively live.
 */

export const runtime = 'nodejs';
export const revalidate = 15;

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const limit = rateLimit(`live:${clientKey(request.headers)}`, 120);
  if (!limit.ok) return NextResponse.json({ error: 'too many requests' }, { status: 429 });

  const { slug: raw } = await ctx.params;
  const slug = safeSlugParam(raw);
  if (!slug) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const event = await repo().getLiveEvent(slug);
  if (!event) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json(
    { status: event.status, entries: event.entries },
    { headers: { 'cache-control': 'public, s-maxage=15, stale-while-revalidate=30' } },
  );
}
