import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * A WordPress dump, written the way the two exporters actually write one.
 *
 * The archive reader has to survive both dialects, and they differ in exactly the ways
 * that break a naive parser: phpMyAdmin names the columns in the `INSERT` and puts one
 * tuple per line; `mysqldump` names none and puts a whole extended insert — every row of
 * a table — on a single line. A reader written against either one alone reads the other
 * as an empty database and reports a successful import of nothing.
 *
 * The content is shaped like the real archive rather than like a tidy example: a classic
 * post with no `<p>` in it, a Gutenberg post, an attachment whose `guid` points at a
 * machine that no longer exists, and a row with the zero date.
 */

export interface Table {
  name: string;
  columns: string[];
  rows: (string | number | null)[][];
}

function quote(value: string | number | null): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `'${escaped}'`;
}

function createTable(table: Table): string {
  const cols = table.columns.map((c) => `  \`${c}\` longtext`).join(',\n');
  return `CREATE TABLE \`${table.name}\` (\n${cols}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n`;
}

/** phpMyAdmin: column names in the INSERT, one tuple per line. */
function phpMyAdmin(table: Table): string {
  if (table.rows.length === 0) return '';
  const cols = table.columns.map((c) => `\`${c}\``).join(', ');
  const tuples = table.rows.map((r) => `(${r.map(quote).join(', ')})`).join(',\n');
  return `--\n-- Despejando dados para a tabela \`${table.name}\`\n--\n\nINSERT INTO \`${table.name}\` (${cols}) VALUES\n${tuples};\n`;
}

/** mysqldump: no column list, every row of the table on one line. */
function mysqldump(table: Table): string {
  if (table.rows.length === 0) return '';
  const tuples = table.rows.map((r) => `(${r.map(quote).join(',')})`).join(',');
  return `INSERT INTO \`${table.name}\` VALUES ${tuples};\n`;
}

export function renderDump(tables: Table[], dialect: 'phpmyadmin' | 'mysqldump'): string {
  const head = '-- test dump\n\n/*!40101 SET NAMES utf8mb4 */;\n\n';
  const body = tables
    .map((t) => {
      const structure = `--\n-- Estrutura para tabela \`${t.name}\`\n--\n\n${createTable(t)}\n`;
      return structure + (dialect === 'phpmyadmin' ? phpMyAdmin(t) : mysqldump(t)) + '\n';
    })
    .join('');
  return head + body + 'COMMIT;\n';
}

const CLASSIC_BODY =
  'James Gunn provoca os fãs sobre o encontro.\n\n' +
  '<figure><img src="https://cdn.exemplo.com/banner.jpg" alt="Superman" /></figure>\n\n' +
  'O encontro pode já ter acontecido no DCU.';

const GUTENBERG_BODY =
  '<!-- wp:paragraph -->\n<p>A nova temporada estreia em outubro.</p>\n<!-- /wp:paragraph -->\n\n' +
  '<!-- wp:heading -->\n<h2>O que muda</h2>\n<!-- /wp:heading -->\n\n' +
  '<!-- wp:image {"id":9001} -->\n<figure class="wp-block-image"><img src="https://www.exemplo.com.br/wp-content/uploads/2025/07/capa.jpg" alt="Capa" /></figure>\n<!-- /wp:image -->';

export const ARCHIVE = {
  siteUrl: 'https://www.exemplo.com.br',
  posts: { published: 2, drafts: 1 },
  attachments: 2,
};

export function archiveTables(prefix = 'wp_'): Table[] {
  const t = (name: string) => `${prefix}${name}`;
  return [
    {
      name: t('options'),
      columns: ['option_id', 'option_name', 'option_value', 'autoload'],
      rows: [
        [1, 'siteurl', ARCHIVE.siteUrl, 'yes'],
        [2, 'home', ARCHIVE.siteUrl, 'yes'],
        [3, 'permalink_structure', '/%postname%/', 'yes'],
        [4, 'gmt_offset', '-3', 'yes'],
        [5, 'upload_path', '', 'yes'],
      ],
    },
    {
      name: t('users'),
      columns: ['ID', 'user_login', 'user_nicename', 'display_name'],
      rows: [[7, 'juliana', 'juliana-prado', 'Juliana Prado']],
    },
    {
      name: t('usermeta'),
      columns: ['umeta_id', 'user_id', 'meta_key', 'meta_value'],
      rows: [[1, 7, 'description', 'Cobre séries.']],
    },
    {
      name: t('terms'),
      columns: ['term_id', 'name', 'slug', 'term_group'],
      rows: [
        [3, 'Filmes', 'filmes', 0],
        [5, 'Notícias', 'noticias', 0],
        [11, 'Netflix', 'netflix', 0],
      ],
    },
    {
      name: t('term_taxonomy'),
      columns: ['term_taxonomy_id', 'term_id', 'taxonomy', 'description', 'parent', 'count'],
      rows: [
        [30, 3, 'category', 'Cinema.', 0, 1],
        [50, 5, 'category', '', 0, 2],
        [110, 11, 'post_tag', '', 0, 1],
      ],
    },
    {
      name: t('term_relationships'),
      columns: ['object_id', 'term_taxonomy_id', 'term_order'],
      rows: [
        // The desk is deliberately *not* first: WordPress orders by term id, so the
        // first category of a post is usually the oldest one it was ever filed under.
        [101, 50, 0],
        [101, 30, 0],
        [101, 110, 0],
        [102, 50, 0],
      ],
    },
    {
      name: t('posts'),
      columns: [
        'ID',
        'post_author',
        'post_date',
        'post_date_gmt',
        'post_content',
        'post_title',
        'post_excerpt',
        'post_status',
        'post_name',
        'post_modified',
        'post_modified_gmt',
        'post_parent',
        'guid',
        'post_type',
        'post_mime_type',
      ],
      rows: [
        [
          101,
          7,
          '2026-07-02 10:00:00',
          '2026-07-02 13:00:00',
          CLASSIC_BODY,
          'Superman e Batman: um encontro secreto?',
          'O que James Gunn deixou escapar.',
          'publish',
          'superman-e-batman-encontro-secreto',
          '2026-07-03 09:00:00',
          '2026-07-03 12:00:00',
          0,
          'https://www.exemplo.com.br/?p=101',
          'post',
          '',
        ],
        [
          102,
          7,
          '2026-07-05 08:30:00',
          '0000-00-00 00:00:00',
          GUTENBERG_BODY,
          'A nova temporada',
          '',
          'publish',
          'a-nova-temporada',
          '2026-07-05 08:30:00',
          '0000-00-00 00:00:00',
          0,
          'https://www.exemplo.com.br/?p=102',
          'post',
          '',
        ],
        [
          103,
          7,
          '2026-07-06 08:30:00',
          '2026-07-06 11:30:00',
          'Rascunho.',
          'Não publicado',
          '',
          'draft',
          'nao-publicado',
          '2026-07-06 08:30:00',
          '2026-07-06 11:30:00',
          0,
          'https://www.exemplo.com.br/?p=103',
          'post',
          '',
        ],
        [
          9001,
          7,
          '2025-07-01 10:00:00',
          '2025-07-01 13:00:00',
          '',
          'capa',
          'Legenda da capa',
          'inherit',
          'capa',
          '2025-07-01 10:00:00',
          '2025-07-01 13:00:00',
          101,
          // The stale host that makes `guid` unusable, exactly as in the real archive.
          'http://13.48.147.139/wp-content/uploads/2025/07/capa.jpg',
          'attachment',
          'image/jpeg',
        ],
        [
          9002,
          7,
          '2025-07-02 10:00:00',
          '2025-07-02 13:00:00',
          '',
          'sem-arquivo',
          '',
          'inherit',
          'sem-arquivo',
          '2025-07-02 10:00:00',
          '2025-07-02 13:00:00',
          0,
          'http://13.48.147.139/wp-content/uploads/2025/07/perdida.jpg',
          'attachment',
          'image/jpeg',
        ],
      ],
    },
    {
      name: t('postmeta'),
      columns: ['meta_id', 'post_id', 'meta_key', 'meta_value'],
      rows: [
        [1, 101, '_thumbnail_id', '9001'],
        [2, 9001, '_wp_attached_file', '2025/07/capa.jpg'],
        [3, 9001, '_wp_attachment_image_alt', 'A capa da edição'],
        [
          4,
          9001,
          '_wp_attachment_metadata',
          'a:5:{s:5:"width";i:1600;s:6:"height";i:900;s:4:"file";s:16:"2025/07/capa.jpg";}',
        ],
        // A second metadata row for the same attachment, as the real archive has.
        [5, 9001, '_wp_attachment_metadata', 'a:5:{s:5:"width";i:1;s:6:"height";i:1;}'],
        [6, 101, '_yoast_wpseo_metadesc', 'Meta que o importador ainda não lê.'],
      ],
    },
  ];
}

/** Writes both dialects (and a gzipped one) to a temp directory. */
export async function writeArchiveDumps(prefix = 'wp_'): Promise<{
  dir: string;
  phpmyadmin: string;
  mysqldump: string;
  gzipped: string;
}> {
  const dir = await mkdtemp(path.join(tmpdir(), 'mn-dump-'));
  const tables = archiveTables(prefix);
  const pma = path.join(dir, 'phpmyadmin.sql');
  const myd = path.join(dir, 'mysqldump.sql');
  const gz = path.join(dir, 'phpmyadmin.sql.gz');
  const pmaText = renderDump(tables, 'phpmyadmin');
  await writeFile(pma, pmaText, 'utf8');
  await writeFile(myd, renderDump(tables, 'mysqldump'), 'utf8');
  await writeFile(gz, gzipSync(Buffer.from(pmaText, 'utf8')));
  return { dir, phpmyadmin: pma, mysqldump: myd, gzipped: gz };
}
