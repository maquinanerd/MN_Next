import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { WordPressArchive, parseValues } from '../../scripts/wp/archive';
import { ARCHIVE, writeArchiveDumps } from '../fake-wp/dump';
import type { WpPost } from '../../scripts/wp/source';

/**
 * The archive reader, against a dump.
 *
 * `source.ts` reads HTTP and `archive.ts` reads a file, and the whole design rests on
 * the claim that consumers cannot tell which one they were given. These cases check the
 * places where that claim is easy to get wrong — rendered content, permalinks, media
 * URLs, taxonomy split — and the two dump dialects, because a reader that understands
 * only one of them reports an empty archive as a clean run.
 */

let dumps: Awaited<ReturnType<typeof writeArchiveDumps>>;

beforeAll(async () => {
  dumps = await writeArchiveDumps();
});

afterAll(async () => {
  if (dumps?.dir) await rm(dumps.dir, { recursive: true, force: true });
});

async function collect<T>(gen: AsyncGenerator<T[]>): Promise<T[]> {
  const out: T[] = [];
  for await (const batch of gen) out.push(...batch);
  return out;
}

describe('parseValues', () => {
  it('reads one tuple', () => {
    expect(parseValues("(1, 'a', NULL)")).toEqual([['1', 'a', null]]);
  });

  it('reads a whole extended insert from one line', () => {
    expect(parseValues("(1,'a'),(2,'b'),(3,'c')")).toHaveLength(3);
  });

  it('is not fooled by a parenthesis or a comma inside a string', () => {
    expect(parseValues("(1, 'texto (com vírgula, e parênteses)')")).toEqual([
      ['1', 'texto (com vírgula, e parênteses)'],
    ]);
  });

  it('unescapes what MySQL escaped', () => {
    expect(parseValues("(1, 'linha\\numa\\'aspa\\\\barra')")).toEqual([['1', "linha\numa'aspa\\barra"]]);
  });

  it('refuses a truncated tuple instead of losing the row', () => {
    expect(() => parseValues("(1, 'sem fecho'")).toThrow(/truncated/i);
  });
});

describe('both dump dialects read the same', () => {
  it('phpMyAdmin and mysqldump produce identical posts', async () => {
    const a = await collect(new WordPressArchive({ dumpPath: dumps.phpmyadmin }).posts());
    const b = await collect(new WordPressArchive({ dumpPath: dumps.mysqldump }).posts());
    expect(a).toHaveLength(ARCHIVE.posts.published);
    expect(b).toEqual(a);
  });

  it('a gzipped dump reads the same as the plain one', async () => {
    const a = await collect(new WordPressArchive({ dumpPath: dumps.phpmyadmin }).posts());
    const gz = await collect(new WordPressArchive({ dumpPath: dumps.gzipped }).posts());
    expect(gz).toEqual(a);
  });
});

describe('what the reader reports about the archive', () => {
  it('counts what is in it, without being told', async () => {
    const facts = await new WordPressArchive({ dumpPath: dumps.phpmyadmin }).prepare();
    expect(facts).toMatchObject({
      siteUrl: ARCHIVE.siteUrl,
      permalinkStructure: '/%postname%/',
      gmtOffsetHours: -3,
    });
    expect(facts.counts.posts).toBe(ARCHIVE.posts.published);
    expect(facts.counts.attachments).toBe(ARCHIVE.attachments);
    expect(facts.counts.categories).toBe(2);
    expect(facts.counts.tags).toBe(1);
  });

  it('says so when the prefix is wrong rather than reporting an empty site', async () => {
    const archive = new WordPressArchive({ dumpPath: dumps.phpmyadmin, tablePrefix: 'wordpress_' });
    await expect(archive.prepare()).rejects.toThrow(/table-prefix/);
  });
});

describe('posts', () => {
  let posts: WpPost[];

  beforeAll(async () => {
    posts = await collect(new WordPressArchive({ dumpPath: dumps.phpmyadmin }).posts());
  });

  it('excludes drafts', () => {
    expect(posts.map((p) => p.slug)).not.toContain('nao-publicado');
  });

  it('renders classic content into paragraphs', () => {
    const classic = posts.find((p) => p.id === 101);
    // The whole reason `wpautop` exists: raw `post_content` has no <p> at all.
    expect(classic?.content).toContain('<p>James Gunn provoca os fãs');
    expect(classic?.content).toContain('<figure>');
  });

  it('strips Gutenberg delimiters and keeps the markup', () => {
    const block = posts.find((p) => p.id === 102);
    expect(block?.content).not.toContain('wp:paragraph');
    expect(block?.content).toContain('<h2>O que muda</h2>');
  });

  it('builds the permalink from permalink_structure', () => {
    expect(posts.find((p) => p.id === 101)?.link).toBe(
      'https://www.exemplo.com.br/superman-e-batman-encontro-secreto/',
    );
  });

  it('splits taxonomy by taxonomy, not by position', () => {
    const post = posts.find((p) => p.id === 101);
    // Term ids, as the REST API reports them, and categories separated from tags.
    expect(post?.categories).toEqual(expect.arrayContaining([3, 5]));
    expect(post?.tags).toEqual([11]);
  });

  it('carries the featured image from _thumbnail_id', () => {
    expect(posts.find((p) => p.id === 101)?.featured_media).toBe(9001);
    expect(posts.find((p) => p.id === 102)?.featured_media).toBe(0);
  });

  it('derives a usable date when post_date_gmt is the zero date', () => {
    const derived = posts.find((p) => p.id === 102);
    // 08:30 local at UTC-3 is 11:30 UTC. Left as `0000-00-00` this is an Invalid Date
    // and the article arrives with no publication date at all.
    expect(derived?.date_gmt).toBe('2026-07-05T11:30:00');
    expect(Number.isNaN(new Date(`${derived?.date_gmt}Z`).getTime())).toBe(false);
  });

  it('honours --since against the modified timestamp', async () => {
    const recent = await collect(new WordPressArchive({ dumpPath: dumps.phpmyadmin }).posts('2026-07-04T00:00:00Z'));
    expect(recent.map((p) => p.id)).toEqual([102]);
  });
});

describe('media', () => {
  it('builds source_url from the uploads path, never from guid', async () => {
    const media = await collect(new WordPressArchive({ dumpPath: dumps.phpmyadmin }).media());
    const capa = media.find((m) => m.id === 9001);
    expect(capa?.source_url).toBe('https://www.exemplo.com.br/wp-content/uploads/2025/07/capa.jpg');
    // The guid in this archive points at an AWS address that stopped serving the site
    // years ago. Trusting it would aim every asset download at a dead host.
    expect(capa?.source_url).not.toContain('13.48.147.139');
  });

  it('takes the first attachment metadata row and ignores the duplicate', async () => {
    const media = await collect(new WordPressArchive({ dumpPath: dumps.phpmyadmin }).media());
    expect(media.find((m) => m.id === 9001)?.media_details).toMatchObject({ width: 1600, height: 900 });
  });

  it('carries alt text and caption', async () => {
    const media = await collect(new WordPressArchive({ dumpPath: dumps.phpmyadmin }).media());
    const capa = media.find((m) => m.id === 9001);
    expect(capa?.alt_text).toBe('A capa da edição');
    expect(capa?.caption).toBe('Legenda da capa');
  });

  it('skips an attachment row whose file is gone, and counts it', async () => {
    const archive = new WordPressArchive({ dumpPath: dumps.phpmyadmin });
    const media = await collect(archive.media());
    expect(media.map((m) => m.id)).not.toContain(9002);
    expect(archive.stats().attachmentsWithoutFile).toBe(1);
  });
});

describe('fetchAsset', () => {
  let uploads: string;

  beforeAll(async () => {
    uploads = path.join(dumps.dir, 'uploads');
    await mkdir(path.join(uploads, '2025', '07'), { recursive: true });
    await writeFile(path.join(uploads, '2025', '07', 'capa.jpg'), Buffer.from('ffd8ffe000104a464946', 'hex'));
    await writeFile(path.join(dumps.dir, 'secret.txt'), 'nao deveria sair daqui');
  });

  it('reads the bytes from disk with no network at all', async () => {
    const archive = new WordPressArchive({ dumpPath: dumps.phpmyadmin, uploadsDir: uploads });
    const asset = await archive.fetchAsset(
      'https://www.exemplo.com.br/wp-content/uploads/2025/07/capa.jpg',
      10_000_000,
    );
    expect(asset?.mimeType).toBe('image/jpeg');
    expect(asset?.data.length).toBeGreaterThan(0);
  });

  it('refuses a path that climbs out of the uploads directory', async () => {
    const archive = new WordPressArchive({ dumpPath: dumps.phpmyadmin, uploadsDir: uploads });
    // The path comes from the archive, and an archive is data: `_wp_attached_file` is a
    // string somebody could have written.
    const escaped = await archive.fetchAsset(
      'https://www.exemplo.com.br/wp-content/uploads/../../secret.txt',
      10_000_000,
    );
    expect(escaped).toBeNull();
  });

  it('refuses a file larger than the limit rather than loading it', async () => {
    const archive = new WordPressArchive({ dumpPath: dumps.phpmyadmin, uploadsDir: uploads });
    expect(await archive.fetchAsset('https://www.exemplo.com.br/wp-content/uploads/2025/07/capa.jpg', 2)).toBeNull();
  });

  it('returns nothing when no uploads directory was given', async () => {
    const archive = new WordPressArchive({ dumpPath: dumps.phpmyadmin });
    expect(
      await archive.fetchAsset('https://www.exemplo.com.br/wp-content/uploads/2025/07/capa.jpg', 10_000_000),
    ).toBeNull();
  });
});
