import type { AdFormato } from '@mn/tokens';

/**
 * AdSense configuration, read from the build's public environment.
 *
 * Three things decide what a slot does, and all three are environment, never code:
 *
 *  - `NEXT_PUBLIC_ADSENSE_CLIENT` — the publisher id (`ca-pub-…`). Absent, no ad code is
 *    emitted at all and the reserved box stays the grey placeholder the kit draws. That
 *    is the default in development, where a real impression would be invalid traffic.
 *  - `NEXT_PUBLIC_ADSENSE_SLOT_<FORMATO>` — the unit id created in the AdSense panel for
 *    that size. A format without an id keeps the placeholder, so the site can be wired up
 *    one slot at a time.
 *  - `NEXT_PUBLIC_ADSENSE_TEST` — `data-adtest="on"`, which serves test creatives and
 *    counts nothing. This is what staging uses: the layout is exercised for real without
 *    earning a cent or risking a policy strike.
 *
 * Both ids are validated against a shape before they reach the DOM. A typo in the panel
 * should render nothing rather than an `<ins>` that asks Google about `undefined`.
 *
 * The references to `process.env` are literal on purpose: Next inlines only literal
 * `process.env.NEXT_PUBLIC_*` reads, so a computed key would resolve to `undefined` in
 * the browser bundle.
 */

const CLIENT = /^ca-pub-\d{10,20}$/;
const SLOT = /^\d{6,20}$/;

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

/** The publisher id, or null when this build serves no ads. */
export function adsenseClient(): string | null {
  const client = clean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);
  return CLIENT.test(client) ? client : null;
}

/** The unit id for a format, or null when that format is not wired up yet. */
export function adsenseSlot(formato: AdFormato): string | null {
  const byFormat: Record<AdFormato, string> = {
    '728x90': clean(process.env.NEXT_PUBLIC_ADSENSE_SLOT_728X90),
    '300x250': clean(process.env.NEXT_PUBLIC_ADSENSE_SLOT_300X250),
    '300x600': clean(process.env.NEXT_PUBLIC_ADSENSE_SLOT_300X600),
    '970x250': clean(process.env.NEXT_PUBLIC_ADSENSE_SLOT_970X250),
  };
  const slot = byFormat[formato];
  return SLOT.test(slot) ? slot : null;
}

/** Whether units ask for test creatives (`data-adtest`), which never count or pay. */
export function adsenseTest(): boolean {
  return clean(process.env.NEXT_PUBLIC_ADSENSE_TEST).toLowerCase() === 'true';
}

/** The hosts the ad stack needs, by CSP directive. Empty when no client is configured. */
export const ADSENSE_CSP = {
  script: [
    'https://pagead2.googlesyndication.com',
    'https://partner.googleadservices.com',
    'https://tpc.googlesyndication.com',
    'https://www.googletagservices.com',
    'https://adservice.google.com',
    'https://adservice.google.com.br',
    'https://fundingchoicesmessages.google.com',
    'https://ep2.adtrafficquality.google',
  ],
  image: [
    'https://pagead2.googlesyndication.com',
    'https://googleads.g.doubleclick.net',
    'https://tpc.googlesyndication.com',
    'https://www.google.com',
    'https://www.google.com.br',
    'https://ep1.adtrafficquality.google',
  ],
  frame: [
    'https://googleads.g.doubleclick.net',
    'https://tpc.googlesyndication.com',
    'https://www.google.com',
    'https://ep2.adtrafficquality.google',
  ],
  connect: [
    'https://pagead2.googlesyndication.com',
    'https://googleads.g.doubleclick.net',
    'https://ep1.adtrafficquality.google',
    'https://csi.gstatic.com',
  ],
} as const;
