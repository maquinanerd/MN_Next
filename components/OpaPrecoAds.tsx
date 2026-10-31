import Script from 'next/script';
import { preconnect } from 'react-dom';
import { OPAPRECO_SITE_KEY, opaPrecoEnabled, opaPrecoEndpoint } from '@mn/ui/ads/opapreco';

/**
 * OpaPreço Ads' script and stylesheet, once for the whole site (root layout).
 *
 *  - The stylesheet goes to `<head>` (`precedence`) and is in the server HTML, because it
 *    carries each slot's reserved height: the space an ad will take is there before any
 *    script runs, and the page does not shift when the ad arrives.
 *  - The script defines `<op-slot>`. `afterInteractive` injects it once hydration has
 *    committed, and that order is the point: defined earlier, the element would fill
 *    itself with OpaPreço's skeleton before React reached it, React would find children
 *    it never rendered, and the hydration mismatch would re-render the page on the client.
 *    The file still downloads from the start (Next preloads it); only its execution
 *    waits. It reads `data-endpoint` and `data-site-key` from its own tag.
 *  - The ad request is a credential-less CORS fetch, which cannot reuse the stylesheet's
 *    connection; `preconnect` opens the anonymous one early, inside the 1.5 s the slot
 *    gives the server before it collapses.
 *
 * Renders nothing when `NEXT_PUBLIC_OPAPRECO_ADS_ENABLED=false`.
 */
export function OpaPrecoAds() {
  if (!opaPrecoEnabled()) return null;
  const endpoint = opaPrecoEndpoint();
  preconnect(endpoint, { crossOrigin: 'anonymous' });

  return (
    <>
      <link rel="stylesheet" href={`${endpoint}/v1/ads/sdk/opapreco-ads.css`} precedence="default" />
      <Script
        id="opapreco-ads"
        strategy="afterInteractive"
        src={`${endpoint}/v1/ads/sdk/opapreco-ads.js`}
        data-endpoint={endpoint}
        data-site-key={OPAPRECO_SITE_KEY}
      />
    </>
  );
}
