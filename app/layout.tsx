import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import { DemoBanner } from '@mn/ui';
import { baseMetadata } from '@mn/seo';

import './globals.css';
import { Footer } from '../components/Chrome';
import { ConsentGate } from '../components/ConsentGate';
import { WebVitals } from '../components/WebVitals';
import { seoContext } from '../lib/seo-context';

/**
 * Root layout.
 *
 * Montserrat — the family the logo is drawn in (kit docs/01) — self-hosted by `next/font`,
 * so production makes no request to Google Fonts; only the six weights the system uses.
 *
 * The header is not here: each page renders it, because the overlay article draws it on
 * top of its cover. The footer is identical everywhere, so it is.
 *
 * Nothing in this file reads a cookie or a header. Doing so would opt the whole route
 * tree out of static rendering and throw away the ISR the delivery strategy rests on.
 */

const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata: Metadata = baseMetadata(seoContext());

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

/** Fixture mode is a demonstration, and the page says so (kit docs/04). */
const isDemo = process.env.CONTENT_SOURCE !== 'kalel';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:top-8 focus:left-8 focus:z-50 focus:bg-white focus:px-16 focus:py-12 focus:text-14 focus:font-bold"
        >
          Ir para o conteúdo
        </a>
        {isDemo ? <DemoBanner /> : null}
        {children}
        <Footer />
        <ConsentGate />
        <WebVitals />
      </body>
    </html>
  );
}
