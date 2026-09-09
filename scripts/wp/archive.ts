import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import nodePath from 'node:path';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

import { CliError } from './cli';
import {
  wpAuthorSchema,
  wpMediaSchema,
  wpPostSchema,
  wpTermSchema,
  type WpAuthor,
  type WpMedia,
  type WpPost,
  type WpReadSource,
  type WpTerm,
} from './source';
import { renderPostContent } from './wpautop';

/**
 * WordPress as an offline archive.
 *
 * `source.ts` reads the REST API and used to say, correctly, that there was no SQL
 * reader and that writing one before the archive arrived would be guesswork about table
 * prefix, plugins and charset. The archive has arrived, so it is not guesswork any more:
 * every decision below is made against the real dump — 41.318 published posts, 73.173
 * attachments, `utf8mb4`, prefix `wp_`, permalinks `/%postname%/`.
 *
 * **It performs no network I/O at all.** Rows come from the dump and asset bytes come
 * from an extracted uploads directory, so an archive import cannot be aimed at anything;
 * the SSRF guard the HTTP source needs has nothing to guard here.
 *
 * Three things the REST API does for free and this reader has to do itself:
 *
 *  - **`the_content`.** The API returns rendered content. A database holds raw content,
 *    and 45% of this archive is classic-editor text with no `<p>` at all. See
 *    `wpautop.ts`; without it those posts import as their figures and nothing else.
 *  - **Permalinks.** `post.link` is computed from `permalink_structure`, because the
 *    redirect table is built from it and every legacy URL depends on it being right.
 *  - **Media URLs.** Built from `home` plus `_wp_attached_file`, *never* from `guid`:
 *    the guids in this archive still point at `http://13.48.147.139`, a machine that has
 *    not served the site for years. An importer that trusted them would make 73.173
 *    requests to a stale AWS address and record every one as a failed asset.
 */

export interface ArchiveOptions {
  /** Path to a `.sql` or `.sql.gz` dump. */
  dumpPath: string;
  /** Table prefix, as in `wp-config.php`. */
  tablePrefix?: string;
  /** Where `wp-content/uploads` was extracted, if asset bytes are needed. */
  uploadsDir?: string;
  /** Overrides the `home` option — only useful when the dump predates a domain change. */
  baseUrl?: string;
}

/** What the archive turned out to contain. Reported, never assumed. */
export interface ArchiveFacts {
  siteUrl: string;
  permalinkStructure: string;
  gmtOffsetHours: number;
  counts: { posts: number; attachments: number; categories: number; tags: number; authors: number };
}

/** Counters that only fill in as the collections are walked. */
export interface ArchiveStats {
  /** Gutenberg block types seen while rendering, with counts. */
  blockTypes: Record<string, number>;
  /** Posts whose `post_date_gmt` was the zero date and had to be derived. */
  derivedDates: number;
  /** Attachment rows whose file was already gone from the media library. */
  attachmentsWithoutFile: number;
}

type Row = Record<string, string | null>;

// ---------------------------------------------------------------- dump reading

const UNESCAPE: Record<string, string> = {
  '0': String.fromCharCode(0),
  b: '\b',
  n: '\n',
  r: '\r',
  t: '\t',
  Z: String.fromCharCode(26),
  '\\': '\\',
  "'": "'",
  '"': '"',
};

/**
 * Every `(...)` tuple in a `VALUES` clause.
 *
 * Written as a scanner rather than a split because both dump dialects have to work:
 * phpMyAdmin puts one tuple per line, `mysqldump` puts a whole extended insert — often
 * megabytes of it — on a single line. A parser that assumed either one would read a
 * perfectly good archive as empty.
 */
export function parseValues(clause: string): (string | null)[][] {
  const tuples: (string | null)[][] = [];
  let i = 0;
  const n = clause.length;

  while (i < n) {
    while (i < n && clause[i] !== '(') i += 1;
    if (i >= n) break;
    i += 1;

    const fields: (string | null)[] = [];
    let field: string | null = null;
    let buf = '';
    let inStr = false;
    let closed = false;

    for (; i < n; i += 1) {
      const c = clause[i] as string;
      if (inStr) {
        if (c === '\\') {
          const next = clause[i + 1] as string;
          buf += UNESCAPE[next] ?? next;
          i += 1;
        } else if (c === "'") {
          inStr = false;
          field = buf;
        } else buf += c;
        continue;
      }
      if (c === "'") {
        inStr = true;
        buf = '';
        continue;
      }
      if (c === ',') {
        fields.push(field);
        field = null;
        continue;
      }
      if (c === ')') {
        closed = true;
        break;
      }
      if (c === ' ' || c === '\t') continue;
      let j = i;
      while (j < n && clause[j] !== ',' && clause[j] !== ')') j += 1;
      const token = clause.slice(i, j).trim();
      field = token === 'NULL' ? null : token;
      i = j - 1;
    }
    // An unterminated tuple means the line was cut. Dropping it silently would lose
    // rows, so it is a hard error rather than a shrug.
    if (!closed) throw new CliError('unterminated tuple in dump — the file looks truncated');
    fields.push(field);
    tuples.push(fields);
  }
  return tuples;
}

function lineStream(dumpPath: string): AsyncIterable<string> {
  const raw = createReadStream(dumpPath);
  const input = dumpPath.endsWith('.gz') ? raw.pipe(createGunzip()) : raw;
  return createInterface({ input, crlfDelay: Infinity });
}

/**
 * One pass over the dump, yielding the rows of the tables asked for.
 *
 * Column names come from the `INSERT` when the dump names them (phpMyAdmin,
 * `mysqldump --complete-insert`) and from the `CREATE TABLE` otherwise, which is what a
 * plain `mysqldump` produces. Guessing the order from the WordPress schema would work
 * until the first site with an extra column.
 *
 * A generator rather than a callback so a caller can stream: rendering 41.318 posts into
 * an array before yielding any of them holds a quarter of a gigabyte of HTML for no
 * reason.
 */
export async function* scanDump(dumpPath: string, tables: Set<string>): AsyncGenerator<{ table: string; row: Row }> {
  const columns = new Map<string, string[]>();
  let creating: string | null = null;
  let current: { table: string; cols: string[] } | null = null;

  for await (const line of lineStream(dumpPath)) {
    if (creating !== null) {
      const col = /^\s*`([^`]+)`\s/.exec(line);
      if (col?.[1]) {
        (columns.get(creating) as string[]).push(col[1]);
        continue;
      }
      if (/^\s*\)/.test(line)) creating = null;
      continue;
    }

    const create = /^CREATE TABLE (?:IF NOT EXISTS )?`([^`]+)`/i.exec(line);
    if (create?.[1]) {
      creating = create[1];
      columns.set(creating, []);
      continue;
    }

    const insert = /^INSERT INTO `([^`]+)`/i.exec(line);
    if (insert?.[1]) {
      const table = insert[1];
      if (!tables.has(table)) {
        current = null;
        continue;
      }
      const named = /\(([^)]*)\)\s+VALUES/i.exec(line)?.[1];
      const cols = named ? named.split(',').map((c) => c.trim().replace(/`/g, '')) : (columns.get(table) ?? []);
      if (cols.length === 0) throw new CliError(`no column names for ${table}: the dump has no CREATE TABLE for it`);
      current = { table, cols };
      const at = line.toUpperCase().indexOf(' VALUES');
      const rest = at === -1 ? '' : line.slice(at + ' VALUES'.length);
      if (rest.includes('(')) yield* rowsOf(current, rest);
      continue;
    }

    if (current === null) continue;
    if (line.startsWith('(')) {
      yield* rowsOf(current, line);
      continue;
    }
    if (line.trim() === '' || line.startsWith('--') || line.startsWith('/*')) current = null;
  }
}

function* rowsOf(current: { table: string; cols: string[] }, clause: string): Generator<{ table: string; row: Row }> {
  for (const values of parseValues(clause)) {
    const row: Row = {};
    current.cols.forEach((c, i) => {
      row[c] = values[i] ?? null;
    });
    yield { table: current.table, row };
  }
}

// ------------------------------------------------------------------- helpers

/** `_wp_attachment_metadata` is PHP-serialised; only two numbers are wanted from it. */
function dimensionsOf(serialised: string): { width?: number; height?: number } {
  const width = /s:5:"width";i:(\d+);/.exec(serialised)?.[1];
  const height = /s:6:"height";i:(\d+);/.exec(serialised)?.[1];
  return {
    ...(width ? { width: Number(width) } : {}),
    ...(height ? { height: Number(height) } : {}),
  };
}

const ZERO_DATE = '0000-00-00 00:00:00';

/** `2026-08-21 13:02:53` as the REST API would have written it. */
function restDate(value: string): string {
  return value.replace(' ', 'T');
}

// --------------------------------------------------------------------- reader

export class WordPressArchive implements WpReadSource {
  private readonly dumpPath: string;
  private readonly prefix: string;
  private readonly uploadsDir: string | null;
  private readonly baseUrlOverride: string | null;
  private ready: Promise<ArchiveFacts> | null = null;

  private readonly options = new Map<string, string>();
  /** term_taxonomy_id -> the term it names and the taxonomy it names it in. */
  private readonly taxonomyById = new Map<number, { termId: number; taxonomy: string }>();
  private readonly terms = new Map<number, { name: string; slug: string; description: string; parent: number }>();
  private readonly termsOfObject = new Map<number, number[]>();
  private readonly userById = new Map<number, { name: string; slug: string; description: string }>();
  private readonly thumbnailOf = new Map<number, number>();
  private readonly attachedFile = new Map<number, string>();
  private readonly altOf = new Map<number, string>();
  private readonly sizeOf = new Map<number, { width?: number; height?: number }>();
  private readonly blockTypes = new Map<string, number>();
  private derivedDates = 0;
  private attachmentsWithoutFile = 0;

  constructor(opts: ArchiveOptions) {
    this.dumpPath = opts.dumpPath;
    this.prefix = opts.tablePrefix ?? 'wp_';
    this.uploadsDir = opts.uploadsDir ? nodePath.resolve(opts.uploadsDir) : null;
    this.baseUrlOverride = opts.baseUrl ?? null;
  }

  static fromEnv(overrides: Partial<ArchiveOptions> = {}): WordPressArchive {
    const dumpPath = overrides.dumpPath ?? process.env.WP_ARCHIVE_DUMP;
    if (!dumpPath) throw new CliError('WP_ARCHIVE_DUMP is not set (path to the .sql or .sql.gz dump)');
    return new WordPressArchive({
      dumpPath,
      ...(process.env.WP_TABLE_PREFIX ? { tablePrefix: process.env.WP_TABLE_PREFIX } : {}),
      ...(process.env.WP_UPLOADS_DIR ? { uploadsDir: process.env.WP_UPLOADS_DIR } : {}),
      ...(process.env.WP_BASE_URL ? { baseUrl: process.env.WP_BASE_URL } : {}),
      ...overrides,
    });
  }

  private table(name: string): string {
    return `${this.prefix}${name}`;
  }

  /** Builds every index the collections read. Runs once, however often it is awaited. */
  prepare(): Promise<ArchiveFacts> {
    this.ready ??= this.build();
    return this.ready;
  }

  stats(): ArchiveStats {
    return {
      blockTypes: Object.fromEntries([...this.blockTypes.entries()].sort((a, b) => b[1] - a[1])),
      derivedDates: this.derivedDates,
      attachmentsWithoutFile: this.attachmentsWithoutFile,
    };
  }

  private async build(): Promise<ArchiveFacts> {
    const wantedMeta = new Set([
      '_thumbnail_id',
      '_wp_attached_file',
      '_wp_attachment_image_alt',
      '_wp_attachment_metadata',
    ]);
    const wantedOptions = new Set([
      'home',
      'siteurl',
      'permalink_structure',
      'gmt_offset',
      'upload_path',
      'upload_url_path',
    ]);
    let attachments = 0;
    let posts = 0;

    const tables = new Set(
      ['options', 'terms', 'term_taxonomy', 'term_relationships', 'users', 'usermeta', 'postmeta', 'posts'].map((t) =>
        this.table(t),
      ),
    );

    for await (const { table, row } of scanDump(this.dumpPath, tables)) {
      switch (table) {
        case this.table('options'): {
          const name = row['option_name'];
          if (name && wantedOptions.has(name)) this.options.set(name, row['option_value'] ?? '');
          break;
        }
        case this.table('terms'):
          this.terms.set(Number(row['term_id']), {
            name: row['name'] ?? '',
            slug: row['slug'] ?? '',
            description: '',
            parent: 0,
          });
          break;
        case this.table('term_taxonomy'): {
          const termId = Number(row['term_id']);
          this.taxonomyById.set(Number(row['term_taxonomy_id']), { termId, taxonomy: row['taxonomy'] ?? '' });
          const term = this.terms.get(termId);
          if (term) {
            term.description = row['description'] ?? '';
            term.parent = Number(row['parent'] ?? 0);
          }
          break;
        }
        case this.table('term_relationships'): {
          const objectId = Number(row['object_id']);
          const ttId = Number(row['term_taxonomy_id']);
          const list = this.termsOfObject.get(objectId);
          if (list) list.push(ttId);
          else this.termsOfObject.set(objectId, [ttId]);
          break;
        }
        case this.table('users'):
          this.userById.set(Number(row['ID']), {
            name: row['display_name'] || row['user_login'] || '',
            slug: row['user_nicename'] ?? '',
            description: '',
          });
          break;
        case this.table('usermeta'): {
          if (row['meta_key'] !== 'description') break;
          const author = this.userById.get(Number(row['user_id']));
          if (author) author.description = row['meta_value'] ?? '';
          break;
        }
        case this.table('postmeta'): {
          const key = row['meta_key'];
          if (!key || !wantedMeta.has(key)) break;
          const postId = Number(row['post_id']);
          const value = row['meta_value'] ?? '';
          if (key === '_thumbnail_id') this.thumbnailOf.set(postId, Number(value));
          else if (key === '_wp_attached_file') this.attachedFile.set(postId, value);
          else if (key === '_wp_attachment_image_alt') this.altOf.set(postId, value);
          // First wins: this archive holds five metadata rows per attachment and they
          // describe the same file. Keeping the strings themselves would hold a gigabyte.
          else if (!this.sizeOf.has(postId)) this.sizeOf.set(postId, dimensionsOf(value));
          break;
        }
        case this.table('posts'):
          if (row['post_type'] === 'attachment') attachments += 1;
          else if (row['post_type'] === 'post' && row['post_status'] === 'publish') posts += 1;
          break;
        default:
          break;
      }
    }

    if (this.terms.size === 0 && posts === 0) {
      throw new CliError(
        `no WordPress tables found in ${this.dumpPath} under prefix "${this.prefix}" — check --table-prefix`,
      );
    }

    return {
      siteUrl: this.siteUrl(),
      permalinkStructure: this.options.get('permalink_structure') ?? '',
      gmtOffsetHours: Number(this.options.get('gmt_offset') ?? '0') || 0,
      counts: {
        posts,
        attachments,
        categories: this.countIn('category'),
        tags: this.countIn('post_tag'),
        authors: this.userById.size,
      },
    };
  }

  private siteUrl(): string {
    const raw = this.baseUrlOverride ?? this.options.get('home') ?? this.options.get('siteurl') ?? '';
    return raw.replace(/\/+$/, '');
  }

  private countIn(taxonomy: string): number {
    let n = 0;
    for (const entry of this.taxonomyById.values()) if (entry.taxonomy === taxonomy) n += 1;
    return n;
  }

  /** The term ids this post carries, split by taxonomy. */
  private taxonomyOf(postId: number): { categories: number[]; tags: number[] } {
    const categories: number[] = [];
    const tags: number[] = [];
    for (const ttId of this.termsOfObject.get(postId) ?? []) {
      const entry = this.taxonomyById.get(ttId);
      if (!entry) continue;
      if (entry.taxonomy === 'category') categories.push(entry.termId);
      else if (entry.taxonomy === 'post_tag') tags.push(entry.termId);
    }
    return { categories, tags };
  }

  /**
   * The permalink WordPress would have served.
   *
   * Built from `permalink_structure`, so the redirect table describes the URLs that are
   * actually in Google's index rather than a guess at their shape. This archive uses
   * `/%postname%/`, which — with `no-category-base-wpml` also installed — is why every
   * legacy article URL is a bare slug at the root while the new one is `/{desk}/{slug}`.
   */
  private permalink(row: Row, categorySlug: string | null): string {
    const site = this.siteUrl();
    const structure = this.options.get('permalink_structure') ?? '';
    if (structure === '') return `${site}/?p=${row['ID'] ?? ''}`;

    // Permalinks use local time, not GMT: %year% is the year the newsroom published in.
    const local = row['post_date'] ?? ZERO_DATE;
    const [date = '', time = ''] = local.split(' ');
    const [yyyy = '', mm = '', dd = ''] = date.split('-');
    const [hh = '', mi = '', ss = ''] = time.split(':');

    const built = structure
      .replace(/%year%/g, yyyy)
      .replace(/%monthnum%/g, mm)
      .replace(/%day%/g, dd)
      .replace(/%hour%/g, hh)
      .replace(/%minute%/g, mi)
      .replace(/%second%/g, ss)
      .replace(/%post_id%/g, row['ID'] ?? '')
      .replace(/%postname%/g, row['post_name'] ?? '')
      .replace(/%category%/g, categorySlug ?? 'uncategorized')
      .replace(/%author%/g, this.userById.get(Number(row['post_author']))?.slug ?? '');
    return `${site}${built.startsWith('/') ? '' : '/'}${built}`;
  }

  /**
   * A GMT timestamp for a row whose `post_date_gmt` is the zero date.
   *
   * WordPress leaves it at zero for posts written before the column existed and for some
   * plugin-created ones. Falling back to `post_date` shifted by the site's offset gives
   * the right instant; leaving the zero date would make `new Date()` produce `Invalid
   * Date` and the article would arrive with no publication date at all.
   */
  private gmtFrom(local: string): string {
    const offset = Number(this.options.get('gmt_offset') ?? '0') || 0;
    const parsed = new Date(`${restDate(local)}Z`);
    if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString().slice(0, 19);
    parsed.setUTCMinutes(parsed.getUTCMinutes() - offset * 60);
    this.derivedDates += 1;
    return parsed.toISOString().slice(0, 19);
  }

  // -------------------------------------------------------------- collections

  async *categories(): AsyncGenerator<WpTerm[]> {
    await this.prepare();
    yield this.termsIn('category');
  }

  async *tags(): AsyncGenerator<WpTerm[]> {
    await this.prepare();
    yield this.termsIn('post_tag');
  }

  private termsIn(taxonomy: string): WpTerm[] {
    const out: WpTerm[] = [];
    for (const entry of this.taxonomyById.values()) {
      if (entry.taxonomy !== taxonomy) continue;
      const term = this.terms.get(entry.termId);
      if (!term) continue;
      out.push(
        wpTermSchema.parse({
          id: entry.termId,
          name: term.name,
          slug: term.slug,
          description: term.description,
          parent: term.parent,
        }),
      );
    }
    return out.sort((a, b) => a.id - b.id);
  }

  async *authors(): AsyncGenerator<WpAuthor[]> {
    await this.prepare();
    yield [...this.userById.entries()]
      .map(([id, a]) => wpAuthorSchema.parse({ id, name: a.name, slug: a.slug, description: a.description }))
      .sort((a, b) => a.id - b.id);
  }

  async *media(batchSize = 200): AsyncGenerator<WpMedia[]> {
    await this.prepare();
    const site = this.siteUrl();
    let batch: WpMedia[] = [];

    for await (const { row } of scanDump(this.dumpPath, new Set([this.table('posts')]))) {
      if (row['post_type'] !== 'attachment') continue;
      const id = Number(row['ID']);
      const file = this.attachedFile.get(id);
      // No `_wp_attached_file` means the row outlived its file.
      if (!file) {
        this.attachmentsWithoutFile += 1;
        continue;
      }
      const caption = row['post_excerpt'];
      batch.push(
        wpMediaSchema.parse({
          id,
          slug: row['post_name'] || String(id),
          source_url: `${site}/wp-content/uploads/${file}`,
          mime_type: row['post_mime_type'] ?? 'application/octet-stream',
          alt_text: this.altOf.get(id) ?? '',
          ...(caption ? { caption: { rendered: caption } } : {}),
          media_details: { ...(this.sizeOf.get(id) ?? {}), file },
        }),
      );
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }
    if (batch.length > 0) yield batch;
  }

  /**
   * Published posts, in the order the dump stores them.
   *
   * That is id order, which is chronological — and a *better* checkpoint key than the
   * HTTP source's `orderby=modified`: an editor touching a 2019 article moves it to the
   * end of a modified-ordered walk, which shifts every position after it and makes a
   * count-based resume skip posts. A file does not move under the reader.
   */
  async *posts(since?: string, batchSize = 200): AsyncGenerator<WpPost[]> {
    await this.prepare();
    const cutoff = since ? new Date(since).getTime() : null;
    let batch: WpPost[] = [];

    for await (const { row } of scanDump(this.dumpPath, new Set([this.table('posts')]))) {
      if (row['post_type'] !== 'post' || row['post_status'] !== 'publish') continue;
      const id = Number(row['ID']);
      const { categories, tags } = this.taxonomyOf(id);

      const rawGmt = row['post_date_gmt'] ?? ZERO_DATE;
      const dateGmt = rawGmt === ZERO_DATE ? this.gmtFrom(row['post_date'] ?? ZERO_DATE) : rawGmt;
      const rawModified = row['post_modified_gmt'] ?? ZERO_DATE;
      const modifiedGmt = rawModified === ZERO_DATE ? dateGmt : rawModified;
      if (cutoff !== null && new Date(`${restDate(modifiedGmt)}Z`).getTime() <= cutoff) continue;

      const primary = categories[0];
      const categorySlug = primary === undefined ? null : (this.terms.get(primary)?.slug ?? null);

      batch.push(
        wpPostSchema.parse({
          id,
          date_gmt: restDate(dateGmt),
          modified_gmt: restDate(modifiedGmt),
          slug: row['post_name'] ?? '',
          status: row['post_status'] ?? 'publish',
          type: row['post_type'] ?? 'post',
          link: this.permalink(row, categorySlug),
          title: { rendered: row['post_title'] ?? '' },
          content: { rendered: renderPostContent(row['post_content'] ?? '', this.blockTypes) },
          excerpt: { rendered: row['post_excerpt'] ?? '' },
          author: Number(row['post_author'] ?? 0),
          featured_media: this.thumbnailOf.get(id) ?? 0,
          categories,
          tags,
        }),
      );
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }
    if (batch.length > 0) yield batch;
  }

  /**
   * Asset bytes, from disk.
   *
   * The URL was built by this class from `_wp_attached_file`, so all this has to do is
   * turn it back into a path — and refuse anything that climbs out of the uploads
   * directory, because the path came from the archive and an archive is data.
   */
  async fetchAsset(url: string, maxBytes: number): Promise<{ data: Buffer; mimeType: string } | null> {
    if (!this.uploadsDir) return null;
    let relative: string;
    try {
      relative = decodeURIComponent(new URL(url).pathname).replace(/^.*\/wp-content\/uploads\//, '');
    } catch {
      return null;
    }
    if (relative === '') return null;

    const resolved = nodePath.resolve(this.uploadsDir, relative);
    if (!resolved.startsWith(this.uploadsDir + nodePath.sep)) return null;

    try {
      const info = await stat(resolved);
      if (!info.isFile() || info.size > maxBytes) return null;
      return { data: await readFile(resolved), mimeType: mimeFromPath(resolved) };
    } catch {
      return null;
    }
  }
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

/**
 * The declared type is a hint only: `importAsset` re-derives it from the magic bytes
 * before anything is uploaded, exactly as it does for the HTTP source.
 */
function mimeFromPath(file: string): string {
  return MIME_BY_EXTENSION[nodePath.extname(file).toLowerCase()] ?? 'application/octet-stream';
}
