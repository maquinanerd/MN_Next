import 'server-only';

import { serverEnv } from './env';
import { FixtureContentRepository } from './fixture/repository';
import { KalElContentRepository } from './kalel/repository';
import type { ContentRepository } from './repository';

/**
 * Single entry point for content.
 *
 * The second of the two guards that keep fixtures out of production: `env.ts` refuses
 * `CONTENT_SOURCE=fixture` when `NODE_ENV=production`, and this function refuses to
 * construct the fixture repository under the same condition even if the environment were
 * assembled some other way. Belt and braces on the one failure that looks like success.
 */

let cached: ContentRepository | null = null;

export function contentRepository(): ContentRepository {
  if (cached) return cached;
  const env = serverEnv();
  if (env.CONTENT_SOURCE === 'fixture') {
    if (env.appEnv === 'production') {
      throw new Error('The fixture content provider must never be constructed in production');
    }
    cached = new FixtureContentRepository();
    return cached;
  }
  cached = new KalElContentRepository();
  return cached;
}

/** Test seam. */
export function setContentRepository(repo: ContentRepository | null): void {
  cached = repo;
}
