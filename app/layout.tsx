import type { Metadata, Viewport } from 'next';
import { DemoBanner } from '@mn/ui';
import { baseMetadata } from '@mn/seo';

import { montserratVariable } from './fonts/montserrat';
import './globals.css';
import { Analytics } from '../components/Analytics';
import { Footer } from '../components/Chrome';
import { ConsentGate } from '../components/ConsentGate';
import { OpaPrecoAds } from '../components/OpaPrecoAds';
import { WebVitals } from '../components/WebVitals';
import { seoContext } from '../lib/seo-context';

/**
 * Root layout.
 *
 * Montserrat comes from files in the repository (`app/fonts`, through `next/font/local`):
 * neither the build nor production makes a request to Google Fonts.
 *
 * The header is not here: each page renders it, because the overlay article draws it on
 * top of its cover. The footer is identical everywhere, so it is.
 *
 * Nothing in this file reads a cookie or a header. Doing so would opt the whole route
 * tree out of static rendering and throw away the ISR the delivery strategy rests on.
 */

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
    <html lang="pt-BR" className={montserratVariable}>
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
        <Analytics />
        <OpaPrecoAds />
      </body>
    </html>
  );
}
