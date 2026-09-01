import type { Article, ArticleSummary, Author, Category, ComparisonItem, LiveEvent, Tag } from '@mn/content';

/**
 * Schema.org graph construction.
 *
 * One `@graph` per page carrying `Organization` + `WebSite` (declared once, in the root
 * layout's shape) plus the page-specific node and a `BreadcrumbList` that mirrors the
 * visible breadcrumbs exactly. Every id is a fragment URI so the nodes reference each
 * other instead of repeating themselves.
 */

export interface SeoContext {
  siteUrl: string;
  siteName: string;
  logoUrl: string;
  sameAs: string[];
}

type Node = Record<string, unknown>;

export function organizationNode(ctx: SeoContext): Node {
  return {
    '@type': 'NewsMediaOrganization',
    '@id': `${ctx.siteUrl}/#organization`,
    name: ctx.siteName,
    url: `${ctx.siteUrl}/`,
    logo: { '@type': 'ImageObject', url: `${ctx.siteUrl}${ctx.logoUrl}` },
    sameAs: ctx.sameAs,
  };
}

export function websiteNode(ctx: SeoContext): Node {
  return {
    '@type': 'WebSite',
    '@id': `${ctx.siteUrl}/#website`,
    url: `${ctx.siteUrl}/`,
    name: ctx.siteName,
    inLanguage: 'pt-BR',
    publisher: { '@id': `${ctx.siteUrl}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${ctx.siteUrl}/busca?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbNode(ctx: SeoContext, crumbs: { label: string; href?: string }[]): Node {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      ...(crumb.href ? { item: absolute(ctx, crumb.href) } : {}),
    })),
  };
}

export function absolute(ctx: SeoContext, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${ctx.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function personNode(ctx: SeoContext, author: Author): Node {
  return {
    '@type': 'Person',
    name: author.name,
    url: absolute(ctx, `/autor/${author.slug}`),
  };
}

function imageNode(ctx: SeoContext, image: Article['cover']): Node | undefined {
  if (!image) return undefined;
  return {
    '@type': 'ImageObject',
    url: absolute(ctx, image.url),
    width: image.width,
    height: image.height,
  };
}

/** Discover invalidates a headline over 110 characters, so it is truncated on a word. */
export function newsHeadline(title: string): string {
  if (title.length <= 110) return title;
  const cut = title.slice(0, 110);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function articleUrl(ctx: SeoContext, article: Pick<ArticleSummary, 'slug' | 'category'>): string {
  return article.category
    ? absolute(ctx, `/${article.category.slug}/${article.slug}`)
    : absolute(ctx, `/${article.slug}`);
}

export function articleNode(ctx: SeoContext, article: Article): Node {
  const url = article.seo.canonical ?? articleUrl(ctx, article);
  const base: Node = {
    '@type': article.seo.schemaType === 'Review' ? 'NewsArticle' : article.seo.schemaType,
    '@id': `${url}#article`,
    headline: newsHeadline(article.title),
    description: article.seo.description ?? article.excerpt,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: article.publishedAt ?? article.updatedAt,
    dateModified: article.updatedAt,
    inLanguage: 'pt-BR',
    isAccessibleForFree: true,
    author: article.authors.map((a) => personNode(ctx, a)),
    publisher: { '@id': `${ctx.siteUrl}/#organization` },
    ...(article.cover ? { image: imageNode(ctx, article.cover) } : {}),
    ...(article.category ? { articleSection: article.category.name } : {}),
    ...(article.tags.length ? { keywords: article.tags.map((t) => t.name).join(', ') } : {}),
    ...(article.commercial
      ? { isBasedOn: undefined, sponsor: { '@type': 'Organization', name: article.commercial.brandName } }
      : {}),
  };

  if (article.seo.schemaType === 'LiveBlogPosting') {
    return {
      ...base,
      '@type': 'LiveBlogPosting',
      coverageStartTime: article.publishedAt ?? article.updatedAt,
      // `coverageEndTime` is deliberately omitted while coverage is open: declaring an
      // end time that has not happened tells Google the live blog is over.
    };
  }

  return base;
}

export function reviewNode(ctx: SeoContext, article: Article): Node | null {
  if (!article.review) return null;
  const url = article.seo.canonical ?? articleUrl(ctx, article);
  return {
    '@type': 'Review',
    '@id': `${url}#review`,
    url,
    name: article.title,
    reviewBody: article.review.verdict,
    datePublished: article.publishedAt ?? article.updatedAt,
    author: article.authors.map((a) => personNode(ctx, a)),
    publisher: { '@id': `${ctx.siteUrl}/#organization` },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: article.review.score,
      bestRating: 10,
      worstRating: 0,
    },
    itemReviewed: {
      '@type': 'Product',
      name: article.review.product.name,
      ...(article.review.product.brand ? { brand: { '@type': 'Brand', name: article.review.product.brand } } : {}),
      ...(article.review.product.image ? { image: absolute(ctx, article.review.product.image.url) } : {}),
    },
  };
}

export function itemListNode(ctx: SeoContext, name: string, items: ComparisonItem[]): Node {
  return {
    '@type': 'ItemList',
    name,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: items.length,
    itemListElement: items.map((item) => ({
      '@type': 'ListItem',
      position: item.rank,
      name: item.name,
      ...(item.image ? { image: absolute(ctx, item.image.url) } : {}),
      ...(item.offer
        ? {
            offers: {
              '@type': 'Offer',
              price: item.offer.price,
              priceCurrency: item.offer.currency,
              availability: item.offer.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              url: item.offer.url,
            },
          }
        : {}),
    })),
  };
}

export function collectionNode(
  ctx: SeoContext,
  opts: { name: string; description: string; url: string; items: ArticleSummary[] },
): Node {
  return {
    '@type': 'CollectionPage',
    '@id': `${opts.url}#collection`,
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: 'pt-BR',
    isPartOf: { '@id': `${ctx.siteUrl}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: articleUrl(ctx, item),
        name: item.title,
      })),
    },
  };
}

export function liveBlogNode(ctx: SeoContext, event: LiveEvent, url: string): Node {
  return {
    '@type': 'LiveBlogPosting',
    '@id': `${url}#liveblog`,
    headline: newsHeadline(event.title),
    url,
    coverageStartTime: event.startedAt,
    ...(event.endedAt ? { coverageEndTime: event.endedAt } : {}),
    publisher: { '@id': `${ctx.siteUrl}/#organization` },
    liveBlogUpdate: event.entries.map((entry) => ({
      '@type': 'BlogPosting',
      headline: newsHeadline(entry.title ?? entry.text.slice(0, 100)),
      datePublished: entry.time,
      articleBody: entry.text,
    })),
  };
}

export function personPageNode(ctx: SeoContext, author: Author, url: string): Node {
  return {
    '@type': 'ProfilePage',
    '@id': `${url}#profile`,
    url,
    mainEntity: {
      ...personNode(ctx, author),
      ...(author.bio ? { description: author.bio } : {}),
      ...(author.role ? { jobTitle: author.role } : {}),
      worksFor: { '@id': `${ctx.siteUrl}/#organization` },
    },
  };
}

/** Assembles the single `@graph`, dropping empty nodes. */
export function buildGraph(ctx: SeoContext, nodes: (Node | null | undefined)[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationNode(ctx), websiteNode(ctx), ...nodes.filter((n): n is Node => Boolean(n))],
  };
}

export type { Category, Tag };
