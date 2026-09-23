import Script from 'next/script';
import { adsenseClient } from '@mn/ui/ads/adsense';

/**
 * The AdSense loader, and the consent it obeys.
 *
 * Order matters and is the whole reason this is two scripts instead of one:
 *
 *  1. An inline script declares `window.adsbygoogle` and, unless the reader has accepted
 *     (`mn-consent=accepted`, written by `ConsentGate`), sets `requestNonPersonalizedAds`.
 *     It runs before the loader, because the flag is read when the library boots — set
 *     afterwards it would arrive too late for the first request, which is the one that
 *     matters. `data-npa-on-unknown-consent` covers the same ground for readers the
 *     library classifies itself. A raw tag rather than `next/script`, because the
 *     `beforeInteractive` strategy belongs to the root layout itself; the string is a
 *     constant, like the theme script, so nothing is serialised into it.
 *  2. `afterInteractive` loads the library once hydration is done, so no ad request ever
 *     competes with the article's own render for the main thread.
 *
 * Refusing consent therefore does not remove advertising, it removes *personalised*
 * advertising — which is what the consent bar says in Portuguese, and what LGPD asks for.
 * A reader who changes their mind gets personalised ads on the next page view; nothing
 * re-requests an ad already on screen.
 *
 * Renders nothing at all when no publisher id is configured, so a development build makes
 * no request to Google and generates no invalid traffic.
 */
export function Adsense() {
  const client = adsenseClient();
  if (!client) return null;

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            'window.adsbygoogle=window.adsbygoogle||[];' +
            'if(!/(?:^|;\\s*)mn-consent=accepted/.test(document.cookie)){window.adsbygoogle.requestNonPersonalizedAds=1}',
        }}
      />
      <Script
        id="adsense-loader"
        strategy="afterInteractive"
        crossOrigin="anonymous"
        data-npa-on-unknown-consent="1"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      />
    </>
  );
}
