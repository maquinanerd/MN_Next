import type { Metadata } from 'next';
import type { Article, ArticleSummary, Image } from '@mn/content';

import { absolute, articleUrl, type SeoContext } from './graph';

/**
 * `generateMetadata` builders.
 *
 * Never client-side tags. Two rules the news templates live or die by:
 *  - a paginated archive is canonical to *itself*; page 2 must never point at page 1,
 *    or the archive disappears from the index;
 *  - search and parameterised tag pages are `noindex, follow` - crawlable, not indexable.
 */

const OG_FALLBACK: Image = {
  url: '/brand/og-default.jpg',
  width: 1200,
  height: 630,
  alt: 'Máquina Nerd',
};

function ogImage(ctx: SeoContext, image: Image | null | undefined) {
  const resolved = image ?? OG_FALLBACK;
  return [
    {
      url: absolute(ctx, resolved.url),
      width: resolved.width,
      height: resolved.height,
      alt: resolved.alt || 'Máquina Nerd',
    },
  ];
}

export function baseMetadata(ctx: SeoContext): Metadata {
  return {
    metadataBase: new URL(ctx.siteUrl),
    title: {
      default: 'Máquina Nerd — cinema, séries, quadrinhos, games e animes',
      template: '%s | Máquina Nerd',
    },
    description:
      'Notícias, análises e especiais de cultura pop: cinema, séries, quadrinhos, games e animes, todo dia no Máquina Nerd.',
    applicationName: ctx.siteName,
    alternates: {
      canonical: '/',
      types: { 'application/rss+xml': `${ctx.siteUrl}/feed.xml` },
    },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: ctx.siteName,
      url: `${ctx.siteUrl}/`,
      images: ogImage(ctx, null),
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
    icons: { icon: '/favicon.ico', apple: '/brand/apple-touch-icon.png' },
  };
}

export function articleMetadata(ctx: SeoContext, article: Article): Metadata {
  const url = article.seo.canonical ?? articleUrl(ctx, article);
  return {
    title: article.seo.title ?? article.title,
    description: article.seo.description ?? article.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      locale: 'pt_BR',
      siteName: ctx.siteName,
      url,
      title: article.seo.title ?? article.title,
      description: article.seo.description ?? article.excerpt,
      publishedTime: article.publishedAt ?? article.updatedAt,
      modifiedTime: article.updatedAt,
      authors: article.authors.map((a) => absolute(ctx, `/autor/${a.slug}`)),
      section: article.category?.name,
      tags: article.tags.map((t) => t.name),
      images: ogImage(ctx, article.seo.ogImage ?? article.cover),
    },
    twitter: {
      card: 'summary_large_image',
      title: article.seo.title ?? article.title,
      description: article.seo.description ?? article.excerpt,
    },
    robots: {
      index: !article.seo.noindex,
      follow: !article.seo.nofollow,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  };
}

export function listingMetadata(
  ctx: SeoContext,
  opts: {
    title: string;
    description: string;
    path: string;
    page?: number;
    noindex?: boolean;
    image?: Image | null;
  },
): Metadata {
  const page = opts.page ?? 1;
  // Page 2 is canonical to page 2. Pointing it at page 1 is how an archive vanishes.
  const canonical = page > 1 ? `${opts.path}/page/${page}` : opts.path;
  const title = page > 1 ? `${opts.title} — página ${page}` : opts.title;
  return {
    title,
    description: opts.description,
    alternates: { canonical: absolute(ctx, canonical) },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: ctx.siteName,
      url: absolute(ctx, canonical),
      title,
      description: opts.description,
      images: ogImage(ctx, opts.image ?? null),
    },
    twitter: { card: 'summary_large_image' },
    robots: opts.noindex ? { index: false, follow: true } : { index: true, follow: true, 'max-image-preview': 'large' },
  };
}

/** Search and any parameterised surface: crawlable, never indexable. */
export function noindexMetadata(ctx: SeoContext, title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: absolute(ctx, path) },
    robots: { index: false, follow: true, nocache: true },
  };
}

export function summaryToOg(ctx: SeoContext, item: ArticleSummary) {
  return ogImage(ctx, item.cover);
}
