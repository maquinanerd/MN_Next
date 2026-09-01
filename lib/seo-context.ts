import { SOCIAL_LINKS } from '@mn/content';
import type { SeoContext } from '@mn/seo';

/**
 * SEO context.
 *
 * Reads `NEXT_PUBLIC_SITE_URL` directly rather than through the server env module: this
 * is imported by `generateMetadata` on routes that also run during a build with no
 * secrets present, and it must never be the thing that fails a build.
 */
export function seoContext(): SeoContext {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return {
    siteUrl,
    siteName: 'Máquina Nerd',
    logoUrl: '/brand/mn-logo-on-light.png',
    sameAs: [...SOCIAL_LINKS.map((s) => s.href), 'https://cinerie.com/'],
  };
}

export function siteUrl(): string {
  return seoContext().siteUrl;
}
