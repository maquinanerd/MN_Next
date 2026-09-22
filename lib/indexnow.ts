import { logger } from './logger';

/**
 * IndexNow: the site tells Bing, Yandex, Seznam and Naver the moment an article is
 * published or changed, instead of waiting for their crawlers to come round. Google does
 * not take part; it reads the sitemaps and the news sitemap.
 *
 * The key is public by design — it is served at `/{key}.txt` (`public/`) so the engines can
 * check that whoever pings owns the host — and proves nothing beyond that. It lives here,
 * not in the environment, because it is not a secret and must match the file exactly.
 */
export const INDEXNOW_KEY = '19c2fbc7303545bff929e721735ba76b';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const TIMEOUT_MS = 5_000;

export interface IndexNowDeps {
  fetchImpl?: typeof fetch;
  /** `APP_ENV`: only production pings. A staging URL must never be announced. */
  appEnv: string | undefined;
  siteUrl: string;
}

/**
 * Announces `paths` (site-relative) for the production host. Never throws: a ping that
 * fails costs a crawl delay on Bing, and must not cost a failed publication webhook.
 */
export async function announce(paths: readonly string[], deps: IndexNowDeps): Promise<'sent' | 'skipped' | 'failed'> {
  if (deps.appEnv !== 'production' || paths.length === 0) return 'skipped';
  let site: URL;
  try {
    site = new URL(deps.siteUrl);
  } catch {
    return 'skipped';
  }
  if (site.protocol !== 'https:' || site.hostname === 'localhost') return 'skipped';

  const body = {
    host: site.hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${site.origin}/${INDEXNOW_KEY}.txt`,
    urlList: paths.map((p) => new URL(p, site.origin).href),
  };
  try {
    const res = await (deps.fetchImpl ?? fetch)(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 200 and 202 both mean received; anything else is logged and dropped.
    if (res.status === 200 || res.status === 202) {
      logger.info('indexnow.sent', { urls: body.urlList.length, status: res.status });
      return 'sent';
    }
    logger.warn('indexnow.refused', { urls: body.urlList.length, status: res.status });
    return 'failed';
  } catch (err) {
    logger.warn('indexnow.failed', { urls: body.urlList.length, error: String(err) });
    return 'failed';
  }
}
