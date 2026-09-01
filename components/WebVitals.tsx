'use client';

import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { useEffect, useState } from 'react';

import { readConsent } from './ConsentGate';

/**
 * Real-user monitoring.
 *
 * Segmented by template and desk, because a site-wide average hides exactly the template
 * that regressed (docs/08). Two privacy properties:
 *
 *  - no measurement leaves the browser without consent, and consent is re-read live so
 *    accepting mid-session starts collection without a reload;
 *  - the payload carries a path *pattern* and the desk, never the full URL, never a
 *    query string and never an identifier.
 */

function templateOf(pathname: string): string {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/especiais/')) return 'especiais';
  if (pathname.startsWith('/ao-vivo/')) return 'ao-vivo';
  if (pathname.startsWith('/reviews/')) return 'review';
  if (pathname.startsWith('/ofertas/')) return 'oferta';
  if (pathname.startsWith('/autor/')) return 'autor';
  if (pathname.startsWith('/tag/')) return 'tag';
  if (pathname.startsWith('/busca')) return 'busca';
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1) return 'categoria';
  if (segments.length >= 2) return 'artigo';
  return 'outro';
}

export function WebVitals() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(readConsent() === 'accepted');
    const onConsent = (event: Event) => {
      setAllowed((event as CustomEvent<string>).detail === 'accepted');
    };
    window.addEventListener('mn:consent', onConsent);
    return () => window.removeEventListener('mn:consent', onConsent);
  }, []);

  useReportWebVitals((metric) => {
    if (!allowed) return;
    const desk = pathname.split('/').filter(Boolean)[0] ?? 'home';
    const body = JSON.stringify({
      name: metric.name,
      value: Math.round(metric.value * 1000) / 1000,
      rating: metric.rating,
      template: templateOf(pathname),
      desk,
    });
    // `sendBeacon` survives the unload that LCP and CLS are reported during.
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/vitals', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/vitals', {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'content-type': 'application/json' },
    });
  });

  return null;
}
