import { createHash } from 'node:crypto';
import path from 'node:path';

import type { Image } from '@mn/content';

import { retryAfterMs, sleep as realSleep, type RunSummary } from './cli';
import { Semaphore, forEachByHost, forEachConcurrent } from './concurrency';
import { defaultLookup, detectImageType, fetchGuarded, type GuardedFetchResult } from './source';
import { mappingKey, type RunState } from './state';
import type { KalElTarget } from './target';
import { EXTERNAL_IMAGE_KIND } from './transform';

/**
 * Third-party body images, downloaded and hosted.
 *
 * 44.304 of the archive's 87.771 body images are hotlinked from other publishers, across
 * 61 hosts. DECISIONS §4.10 left them out; the site's owner reversed that knowingly, so
 * this module carries them over — and it does so without guessing. The 14.445 URLs the
 * archive holds corrupted never reach here: the sanitiser refuses them before the
 * transform sees an image at all, and nothing tries to repair them.
 *
 * The flow is three steps, and the first one is the reason the rest can be trusted:
 *
 *  1. **Collect** by listening to the real transform (`onUnresolvedImage`), so the
 *     spellings collected are exactly the ones the resolver will later be asked about.
 *  2. **Download** under the same guard as the media library (`fetchGuarded`): public
 *     addresses only, every redirect re-checked, the byte cap, the raster sniff —
 *     restricted to the hosts the collection found, two connections per host at most.
 *  3. **Upload and register**, under a stable `externalKey`, so a re-run reuses instead of
 *     downloading again and the post that shows the image resolves it like any other.
 *
 * A third party failing — a 404, a timeout, an HTML error page served as an image — is
 * that party's failure: counted per host, the image dropped from the body as before, the
 * exit code untouched. Kal El failing is ours, and counts as `failed` like any other
 * write that did not land.
 */

/** Identifies the importer to the hosts it downloads from, with somewhere to complain to. */
export const IMPORTER_USER_AGENT = 'MaquinaNerdImporter/1.0 (+https://www.maquinanerd.com.br)';

export const EXTERNAL_KEY_PREFIX = 'wp:external:';

/** Placeholder dimensions, as for a library asset without metadata. Kal El reads the real ones from the bytes. */
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 675;

const SANITISER_ESCAPES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

const NAMED_REFERENCES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

/** Undoes the sanitiser's `escapeHtml`, which escapes exactly these five and nothing else. */
function unescapeSanitised(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => SANITISER_ESCAPES[entity] ?? entity);
}

/**
 * Character references decoded the way a browser reads an attribute value.
 *
 * WordPress writes `&` in a URL as `&#038;` or `&amp;`, and the browser that displayed
 * the article decoded it before requesting the image. Without this, `?w=1&#038;h=2` is
 * parsed as a query ending at `&` and a fragment `#038;h=2` — which is never sent — and
 * the download asks for a different rendition than the article showed.
 */
export function decodeAttribute(value: string): string {
  return value.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (entity: string, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = hex ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    return NAMED_REFERENCES[body.toLowerCase()] ?? entity;
  });
}

/**
 * The URL a reader's browser requested for a body image, given its `src` as the
 * transform hands it to the resolver (escaped by the sanitiser, on top of whatever
 * escaping the archive already had).
 *
 * The query string is kept, always. On these CDNs it *is* the rendition —
 * `?q=50&fit=crop&w=1100&dpr=1.5` — and dropping it would host a different image, often
 * the multi-megabyte original, than the one the article showed. Only the fragment goes:
 * it is never sent to the server, so two URLs differing in it are one download.
 */
export function externalImageUrl(src: string): string | null {
  let url: URL;
  try {
    url = new URL(decodeAttribute(unescapeSanitised(src)));
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  return url.toString();
}

/** 128 bits of SHA-256 over the canonical URL: stable across runs, collision-free at this scale. */
export function externalImageHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 32);
}

export function externalImageKey(hash: string): string {
  return `${EXTERNAL_KEY_PREFIX}${hash}`;
}

/** Alt text for the media record: decoded, one line, within Kal El's 500 characters. */
function mediaAlt(raw: string): string {
  return decodeAttribute(unescapeSanitised(raw)).replace(/\s+/g, ' ').trim().slice(0, 500);
}

/** One third-party image, however many posts show it and however they spell its URL. */
export interface ExternalImage {
  /** What is downloaded, and what the key is derived from. */
  url: string;
  host: string;
  hash: string;
  externalKey: string;
  /** Every spelling of `src` the transform handed over for this URL — each is registered. */
  srcs: string[];
  /** The first non-empty alt text, in reading order. */
  alt: string;
  occurrences: number;
  firstPostId: number | string;
}

/**
 * Gathers the third-party images of a corpus by listening to the transform.
 *
 * Only images the transform itself classified as external are kept, by the same rule
 * that names them `image:external:<host>` in the report — so what is downloaded and what
 * the report calls hotlinked can never be two different sets.
 */
export class ExternalImageCollector {
  private readonly byUrl = new Map<string, ExternalImage>();
  private readonly bySrc = new Map<string, ExternalImage>();
  /** Classified external by the transform, but not a URL once its escaping is undone. */
  unparseable = 0;

  listener(postId: number | string): (image: { src: string; alt: string; kind: string }) => void {
    return ({ src, alt, kind }) => {
      if (!kind.startsWith(EXTERNAL_IMAGE_KIND)) return;
      let image = this.bySrc.get(src);
      if (!image) {
        const url = externalImageUrl(src);
        if (url === null) {
          this.unparseable += 1;
          return;
        }
        image = this.byUrl.get(url);
        if (!image) {
          const hash = externalImageHash(url);
          image = {
            url,
            host: new URL(url).hostname,
            hash,
            externalKey: externalImageKey(hash),
            srcs: [],
            alt: '',
            occurrences: 0,
            firstPostId: postId,
          };
          this.byUrl.set(url, image);
        }
        image.srcs.push(src);
        this.bySrc.set(src, image);
      }
      image.occurrences += 1;
      // The first alt that says something. The first occurrence's alt is often empty
      // while a later post describes the same picture, and an image the reader cannot
      // see is described by whichever text exists, not by whichever came first.
      if (image.alt === '') image.alt = mediaAlt(alt);
    };
  }

  images(): ExternalImage[] {
    return [...this.byUrl.values()];
  }
}

/** What happened to the images of one host. Unique URLs throughout, never occurrences, except where named. */
export interface HostTally {
  host: string;
  uniqueUrls: number;
  occurrences: number;
  transferred: number;
  reused: number;
  /** The host's failures: nothing was downloadable. Not counted as `failed`. */
  failed: number;
  /** Downloaded, but Kal El did not take it. These are counted as `failed`. */
  failedOnKalEl: number;
  failures: Record<string, number>;
  /** A few URLs, so a host that is obviously a placeholder can be recognised as one. */
  samples: string[];
}

export function tallyByHost(images: readonly ExternalImage[]): Map<string, HostTally> {
  const tallies = new Map<string, HostTally>();
  for (const image of images) {
    let tally = tallies.get(image.host);
    if (!tally) {
      tally = {
        host: image.host,
        uniqueUrls: 0,
        occurrences: 0,
        transferred: 0,
        reused: 0,
        failed: 0,
        failedOnKalEl: 0,
        failures: {},
        samples: [],
      };
      tallies.set(image.host, tally);
    }
    tally.uniqueUrls += 1;
    tally.occurrences += image.occurrences;
    if (tally.samples.length < 3) tally.samples.push(image.url);
  }
  return tallies;
}

/** One line of `external-images.ndjson`: the audit trail of what was hosted, and from where. */
export interface ExternalImageOutcome {
  externalKey: string;
  url: string;
  host: string;
  occurrences: number;
  firstPostId: number | string;
  outcome: 'planned' | 'transferred' | 'reused' | 'failed' | 'failed-on-kal-el';
  mediaId?: string;
  reason?: string;
  detail?: string;
}

export interface DownloaderOptions {
  /** The hosts the collection found; a redirect anywhere else is refused. */
  allowedHosts: ReadonlySet<string>;
  maxBytes: number;
  /** Only for `--allow-private-assets`, whose startup check proves the run is local. */
  allowLoopbackHosts?: boolean;
  fetchImpl?: typeof fetch;
  lookupImpl?: (host: string) => Promise<string[]>;
}

/** The production download: `fetchGuarded`, identified, asking only for what Kal El stores. */
export function externalImageDownloader(
  opts: DownloaderOptions,
): (image: ExternalImage) => Promise<GuardedFetchResult> {
  return (image) =>
    fetchGuarded(image.url, {
      allowedHosts: opts.allowedHosts,
      maxBytes: opts.maxBytes,
      maxHops: 3,
      allowLoopbackHosts: opts.allowLoopbackHosts === true,
      fetchImpl: opts.fetchImpl ?? fetch,
      lookupImpl: opts.lookupImpl ?? defaultLookup,
      headers: {
        'user-agent': IMPORTER_USER_AGENT,
        // Raster formats Kal El accepts, and no SVG: a CDN that negotiates the format
        // must not be invited to answer with active content.
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9',
      },
      timeoutMs: 30_000,
    });
}

export interface ExternalImageDeps {
  target: Pick<KalElTarget, 'uploadMedia' | 'updateMediaMetadata'> | null;
  /** `Indexes.imageByUrl`: where the post transform will look each `src` up. */
  imageByUrl: Map<string, Image>;
  state: RunState;
  summary: RunSummary;
  /** Media already in Kal El under these keys, from an earlier run. */
  alreadyImported: Map<string, string>;
  download: (image: ExternalImage) => Promise<GuardedFetchResult>;
  /** Requests to Kal El at once. */
  concurrency: number;
  /** Downloads in flight at once, across every host. */
  downloads: number;
  /** Downloads in flight at once from any single host. */
  perHost: number;
  checkpoint: () => Promise<void>;
  checkpointEvery?: number;
  sleep?: (ms: number) => Promise<void>;
  record?: (outcome: ExternalImageOutcome) => void;
}

/** 429 and 5xx deserve one more try; a 404 or a refused address does not. */
function retryable(result: GuardedFetchResult): boolean {
  return !result.ok && result.status !== undefined && (result.status === 429 || result.status >= 500);
}

async function downloadWithRetry(image: ExternalImage, deps: ExternalImageDeps): Promise<GuardedFetchResult> {
  const first = await deps.download(image);
  if (!retryable(first) || first.ok) return first;
  // The host's own `Retry-After` when it gave one, within reason; otherwise a pause long
  // enough for a hiccup to pass. One retry only: politeness is the point of the limit.
  const wait = first.retryAfter ? Math.min(retryAfterMs(first.retryAfter), 30_000) : 2_000;
  await (deps.sleep ?? realSleep)(wait);
  return deps.download(image);
}

function uploadFilename(image: ExternalImage): string {
  let base = '';
  try {
    base = path.posix.basename(new URL(image.url).pathname);
  } catch {
    base = '';
  }
  return base !== '' && base.length <= 120 ? base : `external-${image.hash}`;
}

/**
 * Transfers every collected image and registers each under every spelling a body used.
 *
 * Without a target (a dry run) nothing leaves the machine: each image is recorded as
 * planned and nothing is registered, so the report still shows them as hotlinks.
 */
export async function importExternalImages(
  images: readonly ExternalImage[],
  deps: ExternalImageDeps,
): Promise<Map<string, HostTally>> {
  const tallies = tallyByHost(images);
  const tallyOf = (image: ExternalImage): HostTally => tallies.get(image.host) as HostTally;
  const outcome = (
    image: ExternalImage,
    rest: Omit<ExternalImageOutcome, 'externalKey' | 'url' | 'host' | 'occurrences' | 'firstPostId'>,
  ): void =>
    deps.record?.({
      externalKey: image.externalKey,
      url: image.url,
      host: image.host,
      occurrences: image.occurrences,
      firstPostId: image.firstPostId,
      ...rest,
    });

  const { target, state, summary } = deps;
  if (!target) {
    for (const image of images) outcome(image, { outcome: 'planned' });
    return tallies;
  }

  const register = (image: ExternalImage, mediaId: string): void => {
    const entry: Image = { url: `/media/${mediaId}`, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, alt: image.alt };
    for (const src of image.srcs) deps.imageByUrl.set(src, entry);
  };

  const reuse: ExternalImage[] = [];
  const transfer: ExternalImage[] = [];
  for (const image of images) {
    const known = deps.alreadyImported.get(image.externalKey) ?? state.mappings[mappingKey('external', image.hash)];
    (known === undefined ? transfer : reuse).push(image);
  }

  // A snapshot for reading: every hash appears in one lane only, so no lane's write can
  // change the answer another lane needs, and the lookup stays constant-time on a
  // re-run that inherited thousands of debts.
  const owed = new Set(state.pendingExternalMeta);
  await forEachConcurrent(reuse, deps.concurrency, async (image) => {
    const mapped = state.mappings[mappingKey('external', image.hash)];
    const mediaId = (deps.alreadyImported.get(image.externalKey) ?? mapped) as string;
    register(image, mediaId);
    tallyOf(image).reused += 1;
    summary.counts.inc('externalImagesReused');
    outcome(image, { outcome: 'reused', mediaId });
    // As for library assets: metadata still owed, or no local record of ever finishing —
    // the file is in Kal El, so an earlier run got that far and whether its second call
    // landed is exactly what nobody knows.
    if (owed.has(image.hash) || mapped === undefined) {
      if (await saveExternalMetadata(target, mediaId, image, state, summary)) {
        state.mappings[mappingKey('external', image.hash)] = mediaId;
      }
    }
  });

  const uploads = new Semaphore(deps.concurrency);
  const every = Math.max(1, deps.checkpointEvery ?? 200);
  let sinceCheckpoint = 0;

  await forEachByHost(
    transfer,
    { hostOf: (image) => image.host, global: deps.downloads, perHost: deps.perHost },
    async (image, slot) => {
      const tally = tallyOf(image);
      const downloaded = await downloadWithRetry(image, deps);
      slot.release();

      const type = downloaded.ok ? detectImageType(downloaded.data) : null;
      if (!downloaded.ok || type === null) {
        const reason = downloaded.ok ? 'not a raster image' : downloaded.reason;
        const detail = downloaded.ok ? `declared ${downloaded.mimeType}` : downloaded.detail;
        tally.failed += 1;
        tally.failures[reason] = (tally.failures[reason] ?? 0) + 1;
        summary.counts.inc('externalImagesFailed');
        outcome(image, { outcome: 'failed', reason, detail });
        return;
      }

      await uploads.run(async () => {
        const uploaded = await target
          .uploadMedia(uploadFilename(image), downloaded.data, type, image.externalKey)
          .catch((err: unknown) => ({ status: 0, id: null, error: err instanceof Error ? err.message : String(err) }));
        if (!uploaded.id) {
          tally.failedOnKalEl += 1;
          summary.counts.inc('failed');
          summary.failures.push({ id: image.externalKey, reason: uploaded.error ?? 'upload failed' });
          outcome(image, { outcome: 'failed-on-kal-el', reason: uploaded.error ?? 'upload failed' });
          return;
        }
        register(image, uploaded.id);
        tally.transferred += 1;
        summary.counts.inc('externalImagesTransferred');
        outcome(image, { outcome: 'transferred', mediaId: uploaded.id });
        if (await saveExternalMetadata(target, uploaded.id, image, state, summary)) {
          state.mappings[mappingKey('external', image.hash)] = uploaded.id;
        }
        sinceCheckpoint += 1;
      });

      // Only a transfer changes what the checkpoint holds. Tested and reset with no await
      // in between, so exactly one lane takes each checkpoint however they interleave.
      if (sinceCheckpoint >= every) {
        sinceCheckpoint = 0;
        await deps.checkpoint();
      }
    },
  );

  return tallies;
}

/**
 * Alt text and the credit line, reporting whether they landed and remembering them if not.
 *
 * The credit names the host the image came from — `Imagem: variety.com` — which is the
 * attribution the portal shows under the picture, and the handle to find every image
 * from one publisher if that publisher asks for them to come down.
 */
async function saveExternalMetadata(
  target: Pick<KalElTarget, 'updateMediaMetadata'>,
  mediaId: string,
  image: ExternalImage,
  state: RunState,
  summary: RunSummary,
): Promise<boolean> {
  const meta = await target
    .updateMediaMetadata(mediaId, { altText: image.alt || null, credit: `Imagem: ${image.host}` })
    .catch((err: unknown) => ({ status: 0, data: null, error: err instanceof Error ? err.message : String(err) }));

  // Read and written with no await in between, so concurrent lanes cannot lose each
  // other's entries.
  const pending = new Set(state.pendingExternalMeta);
  if (meta.data) {
    pending.delete(image.hash);
  } else {
    pending.add(image.hash);
    summary.counts.inc('failed');
    summary.failures.push({ id: image.externalKey, reason: `metadata not saved: ${meta.error ?? 'unknown'}` });
  }
  state.pendingExternalMeta = [...pending];
  return meta.data !== null;
}

/**
 * The totals and the per-host table, most-hotlinked host first.
 *
 * `failed` is the hosts' failures and does not move the exit code; `failedOnKalEl` is the
 * import's own, and is also counted in the run's `failed`.
 */
export function externalImagesSummary(
  images: readonly ExternalImage[],
  tallies: ReadonlyMap<string, HostTally>,
  unparseable: number,
) {
  const hosts = [...tallies.values()].sort((a, b) => b.uniqueUrls - a.uniqueUrls || a.host.localeCompare(b.host));
  const total = (pick: (tally: HostTally) => number): number => hosts.reduce((sum, tally) => sum + pick(tally), 0);
  return {
    uniqueUrls: images.length,
    occurrences: total((t) => t.occurrences),
    hosts: hosts.length,
    transferred: total((t) => t.transferred),
    reused: total((t) => t.reused),
    failed: total((t) => t.failed),
    failedOnKalEl: total((t) => t.failedOnKalEl),
    unparseable,
    byHost: hosts,
  };
}
