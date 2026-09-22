import type {
  Article,
  ArticleSummary,
  ArticleTemplate,
  Author,
  Category,
  CommercialKind,
  CommercialMeta,
  ContentBlock,
  EmbedProvider,
  Image,
  InlineMark,
  RichText,
  SchemaType,
  SeoFields,
  Tag,
} from '../domain/types';
import { EMBED_PROVIDERS } from '../domain/types';
import { lastWriteWasImport } from '../dates';
import { resolveLayout } from '../paths';
import { readingMinutes, slugify } from '../slug';
import { safeHref } from '../sanitize';
import type {
  KalElArticle,
  KalElArticleSummary,
  KalElAuthor,
  KalElCategory,
  KalElDocumentNode,
  KalElEntity,
  KalElMedia,
  KalElSeo,
  KalElTag,
} from './dto';

/**
 * The single place that knows Kal El's vocabulary.
 *
 * Where the CMS model is narrower than the approved front end — no page-layout field, no
 * product model — the gap is closed by reserved taxonomy slugs rather than by inventing
 * CMS fields. Every convention is listed in `docs/migration/KAL-EL-DISCOVERY.md`.
 */

/** Reserved tag slugs that carry editorial intent Kal El has no column for. */
export const RESERVED_TAGS = {
  longform: 'longform',
  urgent: 'ao-vivo',
  sponsored: 'patrocinado',
  affiliate: 'afiliado',
  reviewSample: 'review-amostra',
  campaign: 'campanha',
  /** Brand-safety: ad slots are suppressed server-side on articles carrying these. */
  sensitive: ['morte', 'acidente', 'tragedia', 'processo-judicial', 'violencia'],
} as const;

/** Reserved entity types the mapper reads for commercial metadata. */
export const RESERVED_ENTITY_TYPES = { brand: 'brand', product: 'product' } as const;

/** An edit this soon after publication or import is part of publishing, not an update. */
const EDIT_GRACE_MS = 10 * 60 * 1000;

export interface MapperContext {
  /** Resolved taxonomy, keyed by Kal El id. */
  categories: Map<string, Category>;
  tags: Map<string, Tag>;
  authors: Map<string, Author>;
  media: Map<string, Image>;
  entities?: Map<string, KalElEntity>;
  /** How a media id becomes a URL. Defaults to the authenticated proxy route. */
  mediaUrl?: (mediaId: string) => string;
}

export function defaultMediaUrl(mediaId: string): string {
  return `/media/${mediaId}`;
}

export function mapCategory(dto: KalElCategory): Category {
  return {
    id: dto.id,
    slug: dto.slug,
    name: dto.name,
    description: dto.description ?? '',
    parentId: dto.parentId,
  };
}

export function mapTag(dto: KalElTag): Tag {
  return { id: dto.id, slug: dto.slug, name: dto.name };
}

/** An author. A portrait only when the CMS has one — never a generated initials disc. */
export function mapAuthor(dto: KalElAuthor, media?: Map<string, Image>): Author {
  const avatar = dto.avatarMediaId ? media?.get(dto.avatarMediaId) : undefined;
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    ...(dto.bio ? { bio: dto.bio } : {}),
    ...(avatar ? { avatar } : {}),
  };
}

export function mapMedia(dto: KalElMedia, url: (id: string) => string = defaultMediaUrl): Image {
  return {
    url: url(dto.id),
    // Kal El stores dimensions as nullable. A missing dimension would make `next/image`
    // fall back to layout-shifting behaviour, so a conservative 16:9 is assumed and the
    // asset is reported by the import audit rather than rendered unbounded.
    width: dto.width ?? 1200,
    height: dto.height ?? 675,
    alt: dto.altText ?? '',
    ...(dto.caption ? { caption: dto.caption } : {}),
    ...(dto.credit ? { credit: dto.credit } : {}),
    ...(dto.focalX !== null && dto.focalY !== null && dto.focalX !== undefined && dto.focalY !== undefined
      ? { focalPoint: { x: dto.focalX, y: dto.focalY } }
      : {}),
  };
}

function mapMarks(
  marks: { type: string; attrs?: { href?: string; title?: string; internal?: boolean } }[],
): InlineMark[] {
  const out: InlineMark[] = [];
  for (const mark of marks) {
    if (mark.type === 'link') {
      const href = safeHref(mark.attrs?.href);
      if (!href) continue; // an unsafe href drops the mark, never the text
      out.push({
        type: 'link',
        href,
        ...(mark.attrs?.title ? { title: mark.attrs.title } : {}),
        ...(mark.attrs?.internal !== undefined ? { internal: mark.attrs.internal } : {}),
      });
      continue;
    }
    if (
      mark.type === 'bold' ||
      mark.type === 'italic' ||
      mark.type === 'code' ||
      mark.type === 'underline' ||
      mark.type === 'strike'
    ) {
      out.push({ type: mark.type });
    }
  }
  return out;
}

type KalElInline =
  | { type: 'text'; text: string; marks?: { type: string; attrs?: Record<string, unknown> }[] }
  | { type: 'hardBreak' };

function mapInline(content: KalElInline[]): RichText {
  return content.map((node) => {
    if (node.type === 'hardBreak') return { type: 'break' as const };
    return {
      type: 'text' as const,
      text: node.text,
      marks: mapMarks((node.marks ?? []) as { type: string; attrs?: { href?: string } }[]),
    };
  });
}

function inlineToText(content: RichText): string {
  return content.map((n) => (n.type === 'text' ? n.text : ' ')).join('');
}

function headingId(text: string, index: number): string {
  const base = slugify(text);
  return base.length > 0 ? base : `secao-${index + 1}`;
}

function normaliseEmbedProvider(provider: string, url: string): EmbedProvider | null {
  const p = provider.toLowerCase();
  const known = EMBED_PROVIDERS.find((e) => e === p);
  if (known) return known;
  // Providers drift; fall back to the host so a legitimate embed is not silently lost.
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.endsWith('youtube.com') || host === 'youtu.be') return 'youtube';
    if (host === 'x.com' || host === 'twitter.com') return 'x';
    if (host.endsWith('instagram.com')) return 'instagram';
    if (host.endsWith('tiktok.com')) return 'tiktok';
    if (host.endsWith('vimeo.com')) return 'vimeo';
    if (host.endsWith('spotify.com')) return 'spotify';
  } catch {
    return null;
  }
  return null;
}

export interface DocumentMapResult {
  blocks: ContentBlock[];
  /** Node types the mapper could not represent. Counted, never silently dropped. */
  unknown: Record<string, number>;
  wordCount: number;
}

/** Kal El document (v2) to domain blocks. */
export function mapDocument(
  nodes: KalElDocumentNode[],
  ctx: Pick<MapperContext, 'media' | 'mediaUrl'>,
): DocumentMapResult {
  const blocks: ContentBlock[] = [];
  const unknown: Record<string, number> = {};
  let words = 0;
  let headingIndex = 0;

  const countWords = (text: string) => {
    words += text.split(/\s+/).filter(Boolean).length;
  };

  nodes.forEach((node) => {
    switch (node.type) {
      case 'paragraph': {
        const content = mapInline(node.content as KalElInline[]);
        countWords(inlineToText(content));
        // An empty paragraph is layout noise from an importer, not content.
        if (inlineToText(content).trim() === '') return;
        blocks.push({ type: 'paragraph', content });
        return;
      }
      case 'heading': {
        const content = mapInline(node.content as KalElInline[]);
        const text = inlineToText(content).trim();
        countWords(text);
        const level = node.attrs.level as 2 | 3 | 4;
        blocks.push({ type: 'heading', level, text, id: headingId(text, headingIndex) });
        headingIndex += 1;
        return;
      }
      case 'quote': {
        const content = mapInline(node.content as KalElInline[]);
        countWords(inlineToText(content));
        blocks.push({ type: 'quote', content });
        return;
      }
      case 'list': {
        const items = (node.content as KalElInline[][]).map(mapInline);
        items.forEach((i) => countWords(inlineToText(i)));
        blocks.push({ type: 'list', style: node.attrs.ordered ? 'number' : 'bullet', items });
        return;
      }
      case 'table': {
        const headers = node.attrs.headers ?? [];
        const rows = (node.content as KalElInline[][][]).map((row) => row.map(mapInline));
        rows.forEach((row) => row.forEach((cell) => countWords(inlineToText(cell))));
        blocks.push({ type: 'table', headers, rows });
        return;
      }
      case 'image': {
        const image = ctx.media.get(node.attrs.mediaId);
        if (!image) {
          unknown['image:missing-media'] = (unknown['image:missing-media'] ?? 0) + 1;
          return;
        }
        blocks.push({
          type: 'image',
          image: {
            ...image,
            alt: node.attrs.altText ?? image.alt,
            ...(node.attrs.caption ? { caption: node.attrs.caption } : {}),
            ...(node.attrs.credit ? { credit: node.attrs.credit } : {}),
          },
          size: 'wide',
        });
        return;
      }
      case 'gallery': {
        const images = node.attrs.mediaIds.map((id) => ctx.media.get(id)).filter((i): i is Image => Boolean(i));
        if (images.length === 0) {
          unknown['gallery:missing-media'] = (unknown['gallery:missing-media'] ?? 0) + 1;
          return;
        }
        blocks.push({ type: 'gallery', images });
        return;
      }
      case 'embed': {
        const url = safeHref(node.attrs.url);
        if (!url) {
          unknown['embed:unsafe-url'] = (unknown['embed:unsafe-url'] ?? 0) + 1;
          return;
        }
        const provider = normaliseEmbedProvider(node.attrs.provider, url);
        if (!provider) {
          unknown[`embed:${node.attrs.provider}`] = (unknown[`embed:${node.attrs.provider}`] ?? 0) + 1;
          return;
        }
        blocks.push({ type: 'embed', provider, url, ...(node.attrs.id ? { embedId: node.attrs.id } : {}) });
        return;
      }
      case 'source': {
        const url = safeHref(node.attrs.url);
        if (!url) {
          unknown['source:unsafe-url'] = (unknown['source:unsafe-url'] ?? 0) + 1;
          return;
        }
        blocks.push({
          type: 'sourceLink',
          label: node.attrs.label,
          url,
          ...(node.attrs.kind ? { kind: node.attrs.kind } : {}),
        });
        return;
      }
      default: {
        const t = (node as { type?: string }).type ?? 'unknown';
        unknown[t] = (unknown[t] ?? 0) + 1;
      }
    }
  });

  return { blocks, unknown, wordCount: words };
}

/**
 * Kal El article type + reserved tags to a template. `longform` and `urgent` are editorial
 * flags carried by reserved tags; the rest map one-to-one.
 */
export function resolveTemplate(dto: KalElArticleSummary, tags: Tag[]): ArticleTemplate {
  const slugs = new Set(tags.map((t) => t.slug));
  if (slugs.has(RESERVED_TAGS.urgent)) return 'urgent';
  if (slugs.has(RESERVED_TAGS.longform)) return 'longform';
  switch (dto.type) {
    case 'list':
      return 'list';
    case 'video':
      return 'video';
    default:
      return 'standard';
  }
}

export function resolveSchemaType(template: ArticleTemplate, kalelType: KalElArticleSummary['type']): SchemaType {
  if (kalelType === 'review') return 'Review';
  if (template === 'urgent') return 'LiveBlogPosting';
  if (template === 'longform') return 'Article';
  if (template === 'list') return 'ItemList';
  return 'NewsArticle';
}

export function resolveCommercialKind(tags: Tag[]): CommercialKind | undefined {
  const slugs = new Set(tags.map((t) => t.slug));
  if (slugs.has(RESERVED_TAGS.sponsored)) return 'branded-content';
  if (slugs.has(RESERVED_TAGS.affiliate)) return 'affiliate';
  if (slugs.has(RESERVED_TAGS.reviewSample)) return 'review-sample';
  if (slugs.has(RESERVED_TAGS.campaign)) return 'campaign';
  return undefined;
}

const DISCLOSURE: Record<CommercialKind, string> = {
  'branded-content':
    'Conteúdo produzido em parceria comercial. A redação do Máquina Nerd não participou da elaboração deste material.',
  affiliate:
    'Este conteúdo contém links de afiliados. O Máquina Nerd pode receber comissão por compras feitas por estes links, sem alteração no valor final.',
  'review-sample':
    'O produto avaliado foi cedido pelo fabricante para análise. Isso não condiciona a nota nem o veredito da redação.',
  campaign: 'Campanha publicitária. O conteúdo desta página foi definido pelo anunciante.',
};

export function commercialDisclosure(kind: CommercialKind): string {
  return DISCLOSURE[kind];
}

function mapSeo(
  dto: KalElSeo | null,
  fallback: { title: string; excerpt: string; cover: Image | null; schemaType: SchemaType },
  mediaMap: Map<string, Image>,
): SeoFields {
  const social = dto?.socialImageMediaId ? mediaMap.get(dto.socialImageMediaId) : undefined;
  const ogImage = social ?? fallback.cover ?? undefined;
  return {
    ...(dto?.seoTitle ? { title: dto.seoTitle } : { title: fallback.title }),
    ...(dto?.metaDescription ? { description: dto.metaDescription } : { description: fallback.excerpt }),
    ...(dto?.canonicalUrl ? { canonical: dto.canonicalUrl } : {}),
    ...(ogImage ? { ogImage } : {}),
    noindex: dto?.robotsIndex === 'noindex',
    nofollow: dto?.robotsFollow === 'nofollow',
    schemaType: fallback.schemaType,
  };
}

function excerptFrom(dto: KalElArticleSummary): string {
  return dto.excerpt ?? dto.dek ?? '';
}

/**
 * When a reader should be told the text changed: `updatedAt`, but only when it is later
 * than both the publication and the moment the record was created in Kal El.
 *
 * The second condition is what keeps the archive honest: an imported article is created
 * at import time, years after its publication, and its `updatedAt` is that same moment.
 * Measured against `publishedAt` alone, every one of them would read "Atualizado em" the
 * day of the migration.
 *
 * And a later import session is not an edit either: the second one rewrites every article
 * days after it was created, which the first condition alone would read as 40.907 edits.
 * For an article the import wrote, a write inside an import window is the import
 * (`lastWriteWasImport`); a story the newsroom published in Kal El keeps every edit.
 */
export function editedAt(
  dto: Pick<KalElArticleSummary, 'publishedAt' | 'createdAt' | 'updatedAt' | 'externalKey'>,
): string | null {
  const updated = Date.parse(dto.updatedAt);
  const baseline = Math.max(dto.publishedAt ? Date.parse(dto.publishedAt) : 0, Date.parse(dto.createdAt));
  if (!Number.isFinite(updated) || updated - baseline <= EDIT_GRACE_MS) return null;
  if (lastWriteWasImport(dto)) return null;
  return dto.updatedAt;
}

/**
 * Article summary for cards and listings. An article without a slug cannot be linked;
 * the repository filters those out rather than rendering a card that 404s.
 */
export function mapArticleSummary(dto: KalElArticleSummary, ctx: MapperContext): ArticleSummary | null {
  if (!dto.slug) return null;
  const tags = dto.tags.map((id) => ctx.tags.get(id)).filter((t): t is Tag => Boolean(t));
  const categories = dto.categories.map((id) => ctx.categories.get(id)).filter((c): c is Category => Boolean(c));
  const authors = dto.authors.map((id) => ctx.authors.get(id)).filter((a): a is Author => Boolean(a));
  const category = categories[0] ?? null;
  const cover = dto.featuredMediaId ? (ctx.media.get(dto.featuredMediaId) ?? null) : null;
  const template = resolveTemplate(dto, tags);
  const commercialKind = resolveCommercialKind(tags);

  return {
    id: dto.id,
    brand: 'mn',
    slug: dto.slug,
    template,
    layout: commercialKind === 'affiliate' ? 'offer' : resolveLayout(tags),
    title: dto.title,
    ...(dto.dek ? { subtitle: dto.dek } : {}),
    excerpt: excerptFrom(dto),
    cover,
    authors,
    category,
    tags,
    publishedAt: dto.publishedAt,
    updatedAt: dto.updatedAt,
    status: dto.status,
    // A summary has no body; reading time is recomputed from the document when the
    // article itself is fetched.
    readingMinutes: readingMinutes(excerptFrom(dto).split(/\s+/).filter(Boolean).length * 12),
    ...(commercialKind ? { commercialKind } : {}),
  };
}

export interface MapArticleResult {
  article: Article;
  unknownBlocks: Record<string, number>;
}

export function mapArticle(dto: KalElArticle, ctx: MapperContext): MapArticleResult | null {
  const summary = mapArticleSummary(dto, ctx);
  if (!summary) return null;

  const doc = mapDocument(dto.document.nodes, {
    media: ctx.media,
    ...(ctx.mediaUrl ? { mediaUrl: ctx.mediaUrl } : {}),
  });
  const schemaType = resolveSchemaType(summary.template, dto.type);
  const commercial = buildCommercial(dto, summary.commercialKind, ctx);

  const article: Article = {
    ...summary,
    readingMinutes: readingMinutes(doc.wordCount),
    body: doc.blocks,
    seo: mapSeo(dto.seo, { title: dto.title, excerpt: summary.excerpt, cover: summary.cover, schemaType }, ctx.media),
    editedAt: editedAt(dto),
    ...(commercial ? { commercial } : {}),
  };

  return { article, unknownBlocks: doc.unknown };
}

/**
 * Commercial metadata, from what Kal El can express today: the kind (a reserved tag) and
 * the brand (an entity of type `brand`). Kal El has no product or price model, so no
 * product box and no price is ever derived — the gap and the CMS change that would close
 * it are in `docs/migration/KAL-EL-DISCOVERY.md`.
 */
function buildCommercial(
  dto: KalElArticle,
  kind: CommercialKind | undefined,
  ctx: MapperContext,
): CommercialMeta | undefined {
  if (!kind) return undefined;
  const brandEntity = dto.entities
    .map((id) => ctx.entities?.get(id))
    .find((e) => e?.type === RESERVED_ENTITY_TYPES.brand);
  return {
    kind,
    brandName: brandEntity?.name ?? 'Parceiro comercial',
    disclosure: commercialDisclosure(kind),
  };
}

/** True when ad slots must be suppressed for brand safety (evaluated server-side). */
export function isBrandUnsafe(tags: Tag[]): boolean {
  const sensitive = new Set<string>(RESERVED_TAGS.sensitive);
  return tags.some((t) => sensitive.has(t.slug));
}
