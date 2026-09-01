/**
 * Máquina Nerd domain model.
 *
 * This is the only content vocabulary the routes and components are allowed to know.
 * Kal El field names, endpoint shapes and document node types stop at the mapper
 * (`packages/content/src/kalel/mapper.ts`); nothing above it imports a CMS DTO.
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
  blurDataURL?: string;
}

export interface Author {
  id: ID;
  name: string;
  slug: string;
  /** Avatar initials, as the prototypes render them. */
  initials: string;
  /** CSS custom-property reference, assigned by deterministic hash of `id`. */
  avatarColor: string;
  bio?: string;
  role?: string;
  social?: { x?: string; instagram?: string };
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
  /** Displayed next to the price. A price without a date is a reader complaint. */
  verifiedAt: ISODate;
  coupon?: string;
  listPrice?: number;
}

export type CommercialKind = 'branded-content' | 'affiliate' | 'review-sample' | 'campaign';

export interface CommercialMeta {
  kind: CommercialKind;
  brandName: string;
  brandLogo?: Image;
  /** Server-rendered text. Never generated on the client. */
  disclosure: string;
  offers?: Offer[];
  campaignId?: string;
}

export interface ReviewData {
  articleId: ID;
  product: { name: string; brand?: string; image?: Image };
  /** 0-10, one decimal. */
  score: number;
  breakdown?: { label: string; value: number }[];
  pros: string[];
  cons: string[];
  verdict: string;
}

export interface ComparisonItem {
  rank: number;
  name: string;
  image?: Image;
  score?: number;
  highlight?: string;
  offer?: Offer;
  specs?: { label: string; value: string }[];
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
  | { type: 'paragraph'; content: RichText; dropcap?: boolean }
  | { type: 'heading'; level: 2 | 3 | 4; text: string; id: string }
  | { type: 'image'; image: Image; size?: 'inline' | 'wide' | 'full' }
  | { type: 'gallery'; images: Image[] }
  | { type: 'quote'; content: RichText; attribution?: string }
  | { type: 'list'; style: 'bullet' | 'number'; items: RichText[] }
  | { type: 'table'; headers: string[]; rows: RichText[][] }
  | { type: 'callout'; title?: string; content: RichText; tone: 'neutral' | 'warning' }
  | { type: 'embed'; provider: EmbedProvider; url: string; embedId?: string; aspect?: string }
  | { type: 'sourceLink'; label: string; url: string; kind?: string }
  | { type: 'specTable'; rows: { label: string; value: string }[] }
  | { type: 'comparison'; items: ComparisonItem[] }
  | { type: 'buyBox'; offers: Offer[]; disclosure: string }
  | { type: 'ad'; slot: string }
  | { type: 'whereToWatch'; titles: WatchTitle[] };

export type ContentBlockType = ContentBlock['type'];

export type ArticleStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'blocked' | 'archived';

export interface ArticleSummary {
  id: ID;
  brand: Brand;
  slug: string;
  template: ArticleTemplate;
  title: string;
  subtitle?: string;
  excerpt: string;
  /** The red label above a card headline ("Séries", "Audiência"). */
  kicker?: string;
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
  relatedIds?: ID[];
  liveEventId?: ID;
  videoId?: string;
}

export interface TimelineEntry {
  label: string;
  date?: ISODate;
  text: string;
}

export interface Franchise {
  id: ID;
  slug: string;
  name: string;
  cover: Image | null;
  description: string;
  timeline?: TimelineEntry[];
}

export interface Chapter {
  id: ID;
  title: string;
  blocks: ContentBlock[];
}

export interface Dossier {
  id: ID;
  slug: string;
  franchiseId: ID;
  title: string;
  kicker: string;
  cover: Image | null;
  chapters: Chapter[];
}

export interface LiveEntry {
  id: ID;
  time: ISODate;
  title?: string;
  text: string;
  important?: boolean;
}

export interface LiveEvent {
  id: ID;
  slug: string;
  title: string;
  status: 'live' | 'ended';
  entries: LiveEntry[];
  startedAt: ISODate;
  endedAt?: ISODate;
}

export interface PollOption {
  id: ID;
  label: string;
  image?: Image;
  votes: number;
}

export interface Poll {
  id: ID;
  question: string;
  status: 'open' | 'closed';
  options: PollOption[];
  totalVotes: number;
  /** `cinerie` when the sibling desk owns the poll. */
  source?: Brand;
}

export interface WatchTitle {
  id: ID;
  cinerieSlug: string;
  title: string;
  /** 2:3 poster. */
  poster: Image;
  /** 16:9 still used by the home module. */
  still?: Image;
  kind: 'movie' | 'series';
  availability: { platform: string; type: 'stream' | 'rent' | 'buy' | 'theater'; note?: string }[];
  updatedAt: ISODate;
  url: string;
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

export interface HomeSection {
  key: string;
  label: string;
  href?: string;
  articles: ArticleSummary[];
}

export interface HomePage {
  lead: ArticleSummary | null;
  secondary: ArticleSummary[];
  aside: ArticleSummary[];
  sections: HomeSection[];
  mostRead: ArticleSummary[];
  /** Null when the Cinerie service is unavailable - the module simply does not render. */
  whereToWatch: WatchTitle[] | null;
  poll: Poll | null;
  updatedAt: ISODate;
}

export interface SearchResult extends ArticleSummary {
  highlight?: string;
}

export interface Special {
  franchise: Franchise;
  dossiers: Dossier[];
  articles: ArticleSummary[];
  liveEvent?: LiveEvent | null;
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
