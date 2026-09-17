import type { KalElMediaStorage } from './target';

/**
 * Whether Kal El has room for what an import is about to upload.
 *
 * The media library is 73.173 files and the hotlinked images add tens of thousands more;
 * on a single-disk server the database, the portal and every other service share that
 * disk. Finding out it was too small halfway through the upload is the expensive way —
 * so the importer asks first, and refuses to start rather than fill it.
 */

/**
 * The size assumed for an image whose size cannot be known without downloading it.
 *
 * Deliberately on the high side of a web image — a 1.100px CDN rendition is typically a
 * fraction of this — because an estimate that errs low is the one that fills the disk.
 */
export const ESTIMATED_BYTES_PER_IMAGE = 600 * 1024;

/** Free space must exceed the estimate by this factor: thumbnails, the database, the unforeseen. */
export const STORAGE_HEADROOM = 1.25;

export interface StorageNeed {
  /** Library assets still to upload. */
  libraryAssets: number;
  /** Of those, how many have a size measured on disk rather than estimated. */
  libraryMeasured: number;
  libraryBytes: number;
  /** Third-party images still to upload; always estimated. */
  externalImages: number;
  externalBytes: number;
  totalBytes: number;
}

/** `librarySizes` holds one entry per asset still to upload: its size, or `null` when unknown. */
export function estimateNeed(librarySizes: readonly (number | null)[], externalImages: number): StorageNeed {
  let libraryBytes = 0;
  let libraryMeasured = 0;
  for (const size of librarySizes) {
    if (size === null) {
      libraryBytes += ESTIMATED_BYTES_PER_IMAGE;
    } else {
      libraryBytes += size;
      libraryMeasured += 1;
    }
  }
  const externalBytes = externalImages * ESTIMATED_BYTES_PER_IMAGE;
  return {
    libraryAssets: librarySizes.length,
    libraryMeasured,
    libraryBytes,
    externalImages,
    externalBytes,
    totalBytes: libraryBytes + externalBytes,
  };
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

export function describeNeed(need: StorageNeed): string {
  return (
    `${formatBytes(need.totalBytes)} to upload: ${need.libraryAssets} library assets ` +
    `(${formatBytes(need.libraryBytes)}, ${need.libraryMeasured} measured on disk, ` +
    `${need.libraryAssets - need.libraryMeasured} estimated at ${formatBytes(ESTIMATED_BYTES_PER_IMAGE)}) and ` +
    `${need.externalImages} third-party images (${formatBytes(need.externalBytes)}, estimated)`
  );
}

export interface StorageAnswer {
  status: number;
  data: KalElMediaStorage | null;
  error: string | null;
}

/**
 * The decision, with the numbers behind it.
 *
 * Every way of not knowing refuses, because each of them is a way of starting an upload
 * of tens of gigabytes blind: an instance too old to have the endpoint (404), a token that
 * cannot manage media (403 — and could not upload either), a provider that cannot say
 * how much room it has. `--skip-storage-check` is the operator saying they know; the
 * caller does not ask at all then.
 */
export function storageVerdict(need: StorageNeed, answer: StorageAnswer): { ok: boolean; message: string } {
  if (need.totalBytes === 0) return { ok: true, message: 'nothing left to upload' };

  const skip = 'or pass --skip-storage-check if the space has been verified another way';
  if (answer.status === 404) {
    return {
      ok: false,
      message: `this Kal El does not report its storage (GET /media/storage answered 404); update it, ${skip}`,
    };
  }
  if (answer.status === 403) {
    return {
      ok: false,
      message: 'the service token lacks media.manage, which reading storage and uploading media both require',
    };
  }
  if (answer.error !== null || answer.data === null) {
    return { ok: false, message: `could not read the media storage (${answer.error ?? 'no data'}); ${skip}` };
  }

  const { provider, freeBytes, totalBytes } = answer.data;
  if (freeBytes === null) {
    return { ok: false, message: `the "${provider}" storage provider does not report free space; ${skip}` };
  }

  const required = Math.ceil(need.totalBytes * STORAGE_HEADROOM);
  const numbers =
    `${formatBytes(freeBytes)} free${totalBytes === null ? '' : ` of ${formatBytes(totalBytes)}`} on "${provider}", ` +
    `${formatBytes(required)} required (${formatBytes(need.totalBytes)} × ${STORAGE_HEADROOM})`;
  if (freeBytes < required) return { ok: false, message: `not enough room for this import: ${numbers}` };
  return { ok: true, message: numbers };
}

/** What the uploads directory holds of the library still to transfer. */
export interface UploadsOnDisk {
  found: number;
  foundBytes: number;
  /** Absent, empty, or outside the uploads directory: there is nothing to transfer. */
  missing: number;
  /** On disk, but larger than `--max-asset-mb`: refused at transfer, so it takes no room. */
  overCap: number;
  /** Up to 50 of the missing, lowest media id first. */
  missingSamples: { id: number; url: string }[];
}

/**
 * Sizes for the estimate, and the count of what is and is not on disk.
 *
 * `size` is what the reader measured: `null` when it cannot tell (no uploads directory, or
 * the REST source), `0` when the file is not there to transfer. When nothing could be
 * measured, whether the files exist is unknown, and `uploads` says so by being `null`.
 */
export function tallyUploads(
  measured: readonly { id: number; url: string; size: number | null }[],
  maxBytes: number,
): { sizes: (number | null)[]; uploads: UploadsOnDisk | null } {
  const uploads: UploadsOnDisk = { found: 0, foundBytes: 0, missing: 0, overCap: 0, missingSamples: [] };
  const missing: { id: number; url: string }[] = [];
  let known = 0;
  const sizes = measured.map(({ id, url, size }) => {
    if (size === null) return null;
    known += 1;
    if (size === 0) {
      uploads.missing += 1;
      missing.push({ id, url });
      return 0;
    }
    if (size > maxBytes) {
      uploads.overCap += 1;
      return 0;
    }
    uploads.found += 1;
    uploads.foundBytes += size;
    return size;
  });
  uploads.missingSamples = missing.sort((a, b) => a.id - b.id).slice(0, 50);
  return { sizes, uploads: known === 0 ? null : uploads };
}

export function describeUploads(uploads: UploadsOnDisk | null, pending: number): string {
  if (uploads === null) return 'library files not checked on disk (no --uploads): sizes are estimates';
  return (
    `${uploads.found} of ${pending} library files on disk (${formatBytes(uploads.foundBytes)}); ` +
    `${uploads.missing} missing, ${uploads.overCap} over --max-asset-mb`
  );
}
