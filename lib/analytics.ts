/**
 * Google Analytics 4, configured by the build's public environment.
 *
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` is the web stream's measurement id (`G-…`). Absent, no
 * analytics code is emitted and no request leaves for Google — the default in development,
 * where a page view would only pollute the property. Like every public id it is validated
 * against its shape before it reaches the DOM or the CSP: a typo renders nothing.
 *
 * The id is read with a literal `process.env.NEXT_PUBLIC_*`, the only form Next inlines into
 * the browser bundle.
 */

const MEASUREMENT_ID = /^G-[A-Z0-9]{6,16}$/;

/** The measurement id, or null when this build measures nothing. */
export function gaMeasurementId(): string | null {
  const id = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? '').trim();
  return MEASUREMENT_ID.test(id) ? id : null;
}

/**
 * The hosts GA4 needs, by CSP directive. Empty when no id is configured.
 *
 * The script comes from one named host. The collection endpoint does not: GA4 picks a
 * regional host at run time (`region1.google-analytics.com`, `…analytics.google.com`), so
 * `connect-src` and `img-src` take Google's documented subdomain wildcards — bounded to the
 * two analytics domains, never a bare `https:`. A host list that missed one would drop page
 * views without an error anyone sees.
 */
export const GA_CSP = {
  script: ['https://www.googletagmanager.com'],
  image: ['https://*.google-analytics.com', 'https://*.googletagmanager.com'],
  connect: ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com'],
} as const;

type ConsentState = 'granted' | 'denied';
type ConsentModeUpdate = Record<
  'analytics_storage' | 'ad_storage' | 'ad_user_data' | 'ad_personalization',
  ConsentState
>;
type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    /** gtag's documented opt-out: while true, the tag for that id sends nothing at all. */
    [optOut: `ga-disable-${string}`]: boolean | undefined;
  }
}

/**
 * The accept is for audience measurement only. The ad signals stay denied whatever the
 * answer: the site's ads are OpaPreço's, chosen by the page, and the consent bar and the
 * privacy policy promise nothing about advertising (DECISIONS §7.29).
 */
function consentMode(state: ConsentState): ConsentModeUpdate {
  return { analytics_storage: state, ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
}

/**
 * Applies the reader's answer to the consent bar.
 *
 * Nothing is loaded before an accept: the bar promises that audience measurement waits for
 * it, so the library is not even fetched until then (Consent Mode "basic"). Accepting boots
 * gtag once, with consent already granted. A later refusal in the same document does more
 * than `consent update`, which only stops the cookies — a loaded tag would go on sending
 * cookieless pings, the "advanced" mode the bar does not offer — so it also raises gtag's
 * opt-out flag; a later accept lowers it and grants consent again.
 *
 * Page views after the first are GA4's own: the stream's enhanced measurement counts the
 * App Router's history changes, so nothing here sends one per route and nothing counts twice.
 */
export function applyAnalyticsConsent(id: string, accepted: boolean): void {
  if (window.gtag) {
    window[`ga-disable-${id}`] = !accepted;
    window.gtag('consent', 'update', consentMode(accepted ? 'granted' : 'denied'));
    return;
  }
  if (!accepted) return;

  window[`ga-disable-${id}`] = false;
  window.dataLayer = window.dataLayer ?? [];
  const layer = window.dataLayer;
  // A function that pushes its own `arguments` (eslint.config.mjs says why).
  window.gtag = function gtag() {
    layer.push(arguments);
  };
  window.gtag('consent', 'default', consentMode('granted'));
  window.gtag('js', new Date());
  window.gtag('config', id);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

/**
 * Applies the stored answer and follows every new one (`mn:consent`), so accepting
 * mid-session starts measurement without a reload. Returns the unsubscribe.
 *
 * A preview page is never measured: its address carries the slug of a story not yet
 * published — usually its headline — and the only people who open one are the newsroom.
 */
export function watchAnalyticsConsent(id: string, readConsent: () => string | null): () => void {
  if (window.location.pathname.startsWith('/preview/')) return () => undefined;
  applyAnalyticsConsent(id, readConsent() === 'accepted');
  const onConsent = (event: Event) => {
    applyAnalyticsConsent(id, (event as CustomEvent<string>).detail === 'accepted');
  };
  window.addEventListener('mn:consent', onConsent);
  return () => window.removeEventListener('mn:consent', onConsent);
}
