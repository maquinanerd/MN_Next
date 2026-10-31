import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test as base, type BrowserContext } from '@playwright/test';

/**
 * OpaPreço Ads in the browser gates, without the network.
 *
 * The portal loads OpaPreço's script and stylesheet from https://opapreco.com.br, and its
 * slots ask that origin for ads — which answers 403 to 127.0.0.1. Every test context gets
 * the whole origin routed here instead (an automatic fixture, so a spec only has to import
 * `test` from this file):
 *
 *  - the script and the stylesheet are the copies in `fixtures/opapreco-ads/`, taken from
 *    production on 31/10/2026, so the reserved heights the screenshots show do not move
 *    when OpaPreço ships a new build;
 *  - `/v1/ads/serve` answers 204 (`no_candidates`) by default: every slot collapses, the
 *    deterministic state the visual baselines and the layout tests rest on. A test that
 *    wants ads sets `opapreco.mode = 'ads'` and gets real-shaped responses, one component
 *    per slot and viewport, as OpaPreço picks them;
 *  - beacons answer 204, product images a fixture photo, and the Shopee a blank page.
 *
 * Every ad request and beacon is recorded, so a test can read what the page sent.
 */

export const OPAPRECO = 'https://opapreco.com.br';

const FIXTURES = path.join(__dirname, 'fixtures', 'opapreco-ads');
const SCRIPT = readFileSync(path.join(FIXTURES, 'opapreco-ads.js'));
const STYLESHEET = readFileSync(path.join(FIXTURES, 'opapreco-ads.css'));
const PHOTO = readFileSync(path.join(__dirname, '..', '..', 'public', 'fixtures', 'cover-01.jpg'));

/** The body of `POST /v1/ads/serve` (OpaPreço contract v1.1.0). */
export interface AdRequest {
  siteKey: string;
  slotKey: string;
  page: {
    url?: string;
    canonicalUrl: string;
    title: string;
    section?: string;
    tags?: string[];
    contentId?: string;
  };
  client: { viewport?: 'mobile' | 'tablet' | 'desktop'; locale?: string; containerWidth?: number };
  mode?: 'live' | 'shadow';
}

export interface OpaPrecoStub {
  /** `empty`: every slot gets 204. `ads`: every slot gets an ad. */
  mode: 'empty' | 'ads';
  /** Every ad request, with the headers it went out with. */
  requests: { body: AdRequest; headers: Record<string, string> }[];
  beacons: { kind: 'impression' | 'click'; body: Record<string, unknown> }[];
}

const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'X-OpaPreco-Ads-Reason' };

function offer(slotKey: string, i: number) {
  return {
    offerId: `oferta-${slotKey}-${i}`,
    productTitle: `Produto de teste ${i + 1} do slot ${slotKey}`,
    productImage: `${OPAPRECO}/media/produto-${i + 1}.jpg`,
    imageRatio: 'square',
    currentPrice: 199.9 + i * 10,
    referencePrice: 249.9 + i * 10,
    discountPercent: 20 - i,
    currency: 'BRL',
    merchant: 'Shopee',
    // Recent on purpose: OpaPreço's script refuses to draw a price checked over 6 h ago.
    checkedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    href: `https://s.shopee.com.br/teste-${slotKey}-${i + 1}`,
    eyebrow: 'Oferta verificada',
  };
}

/** The component OpaPreço serves for a slot and viewport (its integration guide, §3). */
function adFor(body: AdRequest) {
  const { slotKey } = body;
  const mobile = body.client.viewport === 'mobile';
  const [component, props] =
    slotKey === 'article-top'
      ? [mobile ? 'product_compact_v1' : 'product_hero_v1', { offer: offer(slotKey, 0) }]
      : slotKey === 'article-inline-01'
        ? ['contextual_recommendation_v1', { offer: offer(slotKey, 0), context: 'Se você gosta de cinema' }]
        : slotKey === 'article-inline-02'
          ? ['product_compact_v1', { offer: offer(slotKey, 0) }]
          : slotKey === 'article-bottom'
            ? [
                'product_grid_v1',
                { heading: 'Mais ofertas verificadas', offers: [0, 1, 2, 3].map((i) => offer(slotKey, i)) },
              ]
            : ['product_card_v1', { offer: offer(slotKey, 0) }];
  return {
    requestId: `pedido-${slotKey}-${Date.now()}`,
    slot: slotKey,
    component,
    props,
    tracking: {
      impressionUrl: `${OPAPRECO}/v1/ads/impression`,
      clickUrl: `${OPAPRECO}/v1/ads/click`,
      token: 'token-de-teste',
    },
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    adId: `anuncio-${slotKey}`,
    mode: 'live',
  };
}

export async function stubOpaPreco(context: BrowserContext): Promise<OpaPrecoStub> {
  const stub: OpaPrecoStub = { mode: 'empty', requests: [], beacons: [] };

  // Registered first, so it only answers what the routes below do not: nothing else on
  // OpaPreço's origin may reach the network.
  await context.route(`${OPAPRECO}/**`, (route) => route.fulfill({ status: 404, headers: cors }));
  await context.route(`${OPAPRECO}/v1/ads/sdk/opapreco-ads.js`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: SCRIPT, headers: cors }),
  );
  await context.route(`${OPAPRECO}/v1/ads/sdk/opapreco-ads.css`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: STYLESHEET, headers: cors }),
  );
  await context.route(`${OPAPRECO}/media/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: PHOTO, headers: cors }),
  );
  await context.route(`${OPAPRECO}/v1/ads/serve`, async (route) => {
    const request = route.request();
    const body = JSON.parse(request.postData() ?? '{}') as AdRequest;
    stub.requests.push({ body, headers: await request.allHeaders() });
    if (stub.mode === 'empty') {
      return route.fulfill({ status: 204, headers: { ...cors, 'x-opapreco-ads-reason': 'no_candidates' } });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(adFor(body)),
      headers: cors,
    });
  });
  for (const kind of ['impression', 'click'] as const) {
    await context.route(`${OPAPRECO}/v1/ads/${kind}`, (route) => {
      stub.beacons.push({ kind, body: JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown> });
      return route.fulfill({ status: 204, headers: cors });
    });
  }
  await context.route('https://s.shopee.com.br/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Shopee (teste)</title>' }),
  );
  return stub;
}

export const test = base.extend<{ opapreco: OpaPrecoStub }>({
  opapreco: [
    async ({ context }, use) => {
      await use(await stubOpaPreco(context));
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
