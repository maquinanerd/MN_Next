/**
 * Máquina Nerd domain model.
 *
 * The content vocabulary every source must produce. Kal El field names, endpoint shapes
 * and document node types stop at the mapper (`packages/content/src/kalel/mapper.ts`);
 * the view model the components render (`@mn/ui` model, built by `lib/content/`) is
 * derived from this, never from a CMS DTO.
 */

export type ID = string;
/** ISO-8601 with offset, e.g. `2026-08-27T14:32:00-03:00`. */
export type ISODate = string;
export type Brand = 'mn' | 'cinerie';

export interface Image {
  /** Absolute URL, or a site-relative path served by the authenticated media proxy. */
  url: string;
  width: number;
  height: number;
  /** Required. Empty string only for decorative art inside an already-labelled link. */
  alt: string;
  caption?: string;
  /** Legally required for agency photography. */
  credit?: string;
  focalPoint?: { x: number; y: number };
}

export interface Author {
  id: ID;
  name: string;
  slug: string;
  bio?: string;
  role?: string;
  social?: { site?: string; facebook?: string; instagram?: string; x?: string };
  /** A real portrait only. Without one the byline shows the name alone. */
  avatar?: Image;
}

export interface Category {
  id: ID;
  slug: string;
  name: string;
  description: string;
  parentId?: ID | null;
}

export interface Tag {
  id: ID;
  slug: string;
  name: string;
}

export type ArticleTemplate = 'standard' | 'longform' | 'urgent' | 'video' | 'list';

/**
 * How the article page is composed (kit docs/03): the standard page with the author rail,
 * the full-bleed cover, or the affiliate/offer page. An editorial choice per article.
 */
export type ArticleLayout = 'standard' | 'overlay' | 'offer';

export type SchemaType = 'NewsArticle' | 'Article' | 'Review' | 'LiveBlogPosting' | 'ItemList';

export interface SeoFields {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: Image;
  noindex: boolean;
  nofollow: boolean;
  schemaType: SchemaType;
}

export interface Offer {
  retailer: string;
  price: number;
  currency: 'BRL';
  /** Always rendered with `rel="sponsored nofollow"`. */
  url: string;
  inStock: boolean;
  /** A price without a date is a reader complaint. */
  verifiedAt: ISODate;
  coupon?: string;
  listPrice?: number;
}

export type CommercialKind = 'branded-content' | 'affiliate' | 'review-sample' | 'campaign';

export interface CommercialMeta {
  kind: CommercialKind;
  brandName: string;
  /** Server-rendered text. Never generated on the client. */
  disclosure: string;
  offers?: Offer[];
}

export interface ReviewData {
  articleId: ID;
  product: { name: string; brand?: string; image?: Image };
  /** 0-10, one decimal. */
  score: number;
  pros: string[];
  cons: string[];
  verdict: string;
}

export type Retailer = 'Amazon' | 'Shopee' | 'Mercado Livre' | 'Magalu' | 'KaBuM!';

/** A product box on an offer page (kit docs/04, `Produto`). */
export interface Product {
  name: string;
  image: Image;
  description: string;
  /** Formatted for display. Never invented: absent means no price is shown. */
  price?: string;
  listPrice?: string;
  /** True when the price is a demonstration value, which the page must say. */
  demo: boolean;
  offers: { retailer: Retailer; url: string; price?: string }[];
}

export interface InlineMark {
  type: 'bold' | 'italic' | 'code' | 'underline' | 'strike' | 'link';
  href?: string;
  title?: string;
  internal?: boolean;
}

export type InlineNode = { type: 'text'; text: string; marks: InlineMark[] } | { type: 'break' };

export type RichText = InlineNode[];

/** Embeds are allowlisted; anything else is dropped and counted by the import report. */
export const EMBED_PROVIDERS = ['youtube', 'x', 'instagram', 'tiktok', 'vimeo', 'spotify'] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

export type ContentBlock =
  | { type: 'paragraph'; content: RichText }
  | { type: 'heading'; level: 2 | 3 | 4; text: string; id: string }
  | { type: 'image'; image: Image; size?: 'inline' | 'wide' }
  | { type: 'gallery'; images: Image[] }
  | { type: 'quote'; content: RichText; attribution?: string }
  | { type: 'list'; style: 'bullet' | 'number'; items: RichText[] }
  | { type: 'table'; headers: string[]; rows: RichText[][] }
  | { type: 'embed'; provider: EmbedProvider; url: string; embedId?: string }
  | { type: 'sourceLink'; label: string; url: string; kind?: string }
  | { type: 'product'; product: Product };

export type ContentBlockType = ContentBlock['type'];

export type ArticleStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'blocked' | 'archived';

export interface ArticleSummary {
  id: ID;
  brand: Brand;
  slug: string;
  template: ArticleTemplate;
  layout: ArticleLayout;
  title: string;
  subtitle?: string;
  excerpt: string;
  cover: Image | null;
  authors: Author[];
  category: Category | null;
  tags: Tag[];
  publishedAt: ISODate | null;
  updatedAt: ISODate;
  status: ArticleStatus;
  /** Derived from the body, never typed in. */
  readingMinutes: number;
  commercialKind?: CommercialKind;
}

export interface Article extends ArticleSummary {
  body: ContentBlock[];
  seo: SeoFields;
  commercial?: CommercialMeta;
  review?: ReviewData;
  /**
   * When the text was last *edited*, as a reader understands it — null when it never was.
   *
   * Not `updatedAt`: an imported article's record is written at import time, so its
   * `updatedAt` is the day of the migration, and printing "Atualizado em" with that date
   * under 41 thousand articles would be false on every one of them.
   */
  editedAt: ISODate | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  perPage: number;
  /** Null when the source cannot produce an exact count (cursor pagination). */
  total: number | null;
  totalPages: number | null;
  hasNext: boolean;
}

export interface SearchResult extends ArticleSummary {
  highlight?: string;
}

export type SitemapKind = 'articles' | 'categories' | 'tags' | 'authors' | 'news';

export interface SitemapEntry {
  path: string;
  lastModified: ISODate;
  /** Present only for `news` entries. */
  title?: string;
  publishedAt?: ISODate;
}

export interface SitemapPage {
  entries: SitemapEntry[];
  nextCursor: string | null;
}

export interface LegacyRedirect {
  from: string;
  to: string;
  status: 301 | 302 | 410;
}

export interface ReadOptions {
  /** Draft mode: bypass the published filter and every shared cache. */
  preview?: boolean;
}
