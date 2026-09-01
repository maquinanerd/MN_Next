import 'server-only';
import { z } from 'zod';

import { TAG, REVALIDATE } from '../cache-tags';
import type { Poll, WatchTitle } from '../domain/types';
import { serverEnv } from '../env';
import { safeHref } from '../sanitize';

/**
 * Cinerie internal read API.
 *
 * The only rule that matters here: **a Cinerie failure never takes a Máquina Nerd page
 * down**. Every function returns `null` on any failure - unconfigured, timeout, 5xx,
 * schema drift - and the calling surface renders nothing. There is no retry and no
 * error propagation, because there is no page state worth degrading for a module that
 * is, by design, optional.
 *
 * Never called from the browser: the service token is server-only.
 */

const CINERIE_TIMEOUT_MS = 3_000;

const imageSchema = z.object({
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().default(''),
});

const watchTitleSchema = z.object({
  id: z.string(),
  cinerieSlug: z.string(),
  title: z.string(),
  poster: imageSchema,
  still: imageSchema.optional(),
  kind: z.enum(['movie', 'series']),
  availability: z.array(
    z.object({
      platform: z.string(),
      type: z.enum(['stream', 'rent', 'buy', 'theater']),
      note: z.string().optional(),
    }),
  ),
  updatedAt: z.string(),
  url: z.string(),
});

const pollSchema = z.object({
  id: z.string(),
  question: z.string(),
  status: z.enum(['open', 'closed']),
  options: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      image: imageSchema.optional(),
      votes: z.number().int().nonnegative(),
    }),
  ),
  totalVotes: z.number().int().nonnegative(),
});

async function cinerieFetch<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  tags: string[],
): Promise<z.infer<T> | null> {
  let env: ReturnType<typeof serverEnv>;
  try {
    env = serverEnv();
  } catch {
    return null;
  }
  if (!env.CINERIE_INTERNAL_URL || !env.CINERIE_SERVICE_TOKEN) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CINERIE_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.CINERIE_INTERNAL_URL}${path}`, {
      headers: {
        authorization: `Bearer ${env.CINERIE_SERVICE_TOKEN}`,
        accept: 'application/json',
      },
      signal: controller.signal,
      next: { tags, revalidate: REVALIDATE.cinerie },
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const parsed = schema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Availability cards for the home module and the `whereToWatch` body block. */
export async function getCinerieTitles(ids?: string[]): Promise<WatchTitle[] | null> {
  const suffix = ids && ids.length > 0 ? `?ids=${encodeURIComponent(ids.slice(0, 24).join(','))}` : '';
  const rows = await cinerieFetch(`/api/internal/titles${suffix}`, z.array(watchTitleSchema), [TAG.cinerie]);
  if (!rows) return null;
  const safe = rows
    .map((row) => {
      const url = safeHref(row.url);
      const posterUrl = safeHref(row.poster.url);
      if (!url || !posterUrl) return null;
      const title: WatchTitle = {
        ...row,
        url,
        poster: { ...row.poster, url: posterUrl },
      };
      return title;
    })
    .filter((t): t is WatchTitle => t !== null);
  return safe.length > 0 ? safe : null;
}

export async function getCineriePoll(id: string): Promise<Poll | null> {
  const row = await cinerieFetch(`/api/internal/polls/${encodeURIComponent(id)}`, pollSchema, [TAG.cinerie]);
  if (!row) return null;
  return { ...row, source: 'cinerie' };
}
