/**
 * ISR and data cache in memory, never on the container's disk.
 *
 * Next's default handler writes every page it renders (`.html`, `.rsc`, `.meta` and the
 * `.segments/` files) under `.next/server/app`, and every cached `fetch` under
 * `.next/cache/fetch-cache` — inside the container's writable layer, since nothing else
 * is mounted there. Measured on 28/09/2026: two minutes after a deploy the container
 * already held 1,388 fetch-cache files and 114 page files; at 17 minutes, 18,011 and
 * 1,221 — about 1,100 files a minute. After a few days that is millions of small files,
 * and Docker can no longer remove the container inside the 60 seconds Coolify gives it:
 * every deploy from 25/09 on failed at the container swap ("removal of container … is
 * already in progress"), and the one on 28/09 left the site answering 503 for three hours.
 *
 * This is Next's own FileSystemCache with disk writes turned off:
 *
 *  - reads still fall back to disk, so the pages `next build` prerendered keep being
 *    served from the build output;
 *  - writes go to the LRU in memory (`cacheMaxMemorySize` in next.config.ts), which starts
 *    empty after a deploy — as the disk cache already did, every deploy being a new
 *    container;
 *  - `next build` is unaffected: it writes the prerendered pages through the export step
 *    (`next/dist/export/routes/app-page.js`), not through this cache.
 *
 * Optimized images are a separate cache (`.next/cache/images`), unaffected by this
 * handler; docker-compose.coolify.yml gives them a volume.
 *
 * `next/dist/...` is Next's internal module. It is pinned by the lockfile;
 * tests/unit/next-cache-handler.test.ts and the image job in CI fail if an upgrade changes
 * its shape.
 */
import fileSystemCache from 'next/dist/server/lib/incremental-cache/file-system-cache.js';

/** @type {typeof import('next/dist/server/lib/incremental-cache/file-system-cache').default} */
const FileSystemCache = fileSystemCache.default ?? fileSystemCache;

export default class MemoryOnlyCache extends FileSystemCache {
  /** @param {ConstructorParameters<typeof FileSystemCache>[0]} ctx */
  constructor(ctx) {
    super({ ...ctx, flushToDisk: false });
  }
}
