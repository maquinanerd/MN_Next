import { adsenseClient } from '@mn/ui/ads/adsense';

/**
 * ads.txt (IAB Tech Lab 1.1).
 *
 * The file authorises who may sell this domain's inventory. Without it, most demand
 * treats the inventory as unauthorised and bids down or not at all — and AdSense reports
 * the site as "Earnings at risk". One line is enough for a publisher whose only seller is
 * Google: the account id and Google's own exchange id, which is a public constant.
 *
 * Generated rather than a file in `public/`, for the same reason robots.txt is: it
 * follows the publisher id the deployment is actually configured with, so a build without
 * ads answers 404 instead of claiming a seller it never loads.
 */
export const dynamic = 'force-dynamic';

/** Google's own `ads.txt` certification authority id — the same for every publisher. */
const GOOGLE_TAG_ID = 'f08c47fec0942fa0';

export function GET(): Response {
  const client = adsenseClient();
  if (!client) return new Response('Not found', { status: 404 });

  const account = client.replace(/^ca-/, '');
  return new Response(`google.com, ${account}, DIRECT, ${GOOGLE_TAG_ID}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
