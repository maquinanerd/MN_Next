'use client';

import { useEffect, useRef } from 'react';

/**
 * Asks AdSense to fill the `<ins>` that precedes this component.
 *
 * The library fills a unit only when something pushes to `adsbygoogle`, and it must be
 * pushed once per unit: a second push on a filled `<ins>` throws
 * "All ins elements in the DOM with class=adsbygoogle already have ads in them". The ref
 * guard covers React's double effect invocation in development.
 *
 * Every failure here is swallowed. An advert that cannot ask for itself leaves a reserved
 * empty box, which is the state the layout already draws; it must never take the article
 * down with it.
 */
export function AdPush() {
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle ?? [];
      w.adsbygoogle.push({});
    } catch {
      /* no ad, no error page */
    }
  }, []);

  return null;
}
