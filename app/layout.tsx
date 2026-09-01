import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import { NAV_ITEMS } from '@mn/content';
import { NetworkBar, SiteFooter, SiteHeader } from '@mn/ui';
import { baseMetadata } from '@mn/seo';

import './globals.css';
import { seoContext } from '../lib/seo-context';
import { THEME_SCRIPT } from '../lib/theme-script';
import { ConsentGate } from '../components/ConsentGate';
import { WebVitals } from '../components/WebVitals';

/**
 * Root layout.
 *
 * The appearance theme is applied by a tiny blocking script (`lib/theme-script.ts`,
 * whose hash is what the CSP allows) that reads the same cookie
 * the toggle writes, rather than by `cookies()` in this component. That distinction
 * matters more than it looks: reading a cookie here opts the *entire* route tree out of
 * static rendering, which would turn every ISR page into an on-demand render and throw
 * away the caching the whole delivery strategy depends on (docs/08). The script runs
 * before first paint, so there is still no light-to-dark flash, and it is a cookie -
 * not `localStorage` alone, which is the pattern the design docs rule out.
 *
 * Figtree is self-hosted by `next/font`, so production makes no request to
 * `fonts.googleapis.com`; only the six weights the design uses are loaded.
 */

const figtree = Figtree({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-figtree',
});

export const metadata: Metadata = baseMetadata(seoContext());

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0c' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" data-brand="mn" className={figtree.variable} suppressHydrationWarning>
      <head>
        {/* Inline and blocking on purpose: it must run before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="mn-skip" href="#conteudo">
          Ir para o conteúdo
        </a>
        <div className="mn-page">
          <NetworkBar active="mn" />
          <SiteHeader nav={NAV_ITEMS} brand="mn" />
          <main id="conteudo">{children}</main>
          <SiteFooter />
        </div>
        <ConsentGate />
        <WebVitals />
        {/*
          There is deliberately no JSON-LD here. The SEO decision is one `@graph` per
          page; `buildGraph()` prepends the Organization and WebSite nodes to every
          page's own node, so the network is declared exactly once per document.
        */}
      </body>
    </html>
  );
}
