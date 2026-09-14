import { NextResponse } from 'next/server';
import { isContentError } from '@mn/content';
import { serverEnv } from '@mn/content/env';
import { kalelArticleListSchema } from '@mn/content/kalel/dto';
import { KalElTransport } from '@mn/content/kalel/transport';

/**
 * Liveness and readiness.
 *
 * `/api/health` answers as long as the process is up - it is what a restart policy and
 * the container healthcheck watch, and it must not fail because a dependency is down: a
 * CMS blip must not get the container killed and restarted into the same blip.
 *
 * `?ready=1` is readiness: a valid environment, and Kal El answering the request delivery
 * cannot work without - an authenticated article list, shaped like every listing the site
 * renders (publication order, one row, from offset 0), never cached. One call, three
 * verdicts:
 *
 *   kalel     the CMS answered and accepted this service token for this site
 *             (`ok`, `unauthorized`, `fail` for any other refusal, `unreachable`);
 *   contract  the list parses (`fail` when it does not) and carries `total` - which
 *             Kal El sends for an `offset` query only once the publication-order change
 *             (kal-el#7) is deployed. Without it (`degraded`) the site still renders, by
 *             walking the cursor, but numbered pages are slow and a deep one is a 404:
 *             not the deployment the runbook signs off, so not ready.
 *
 * Neither response names a host, a token or a version an attacker could fingerprint.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'cache-control': 'no-store' };

/** A load balancer's probe has its own deadline; this one answers well inside it. */
const PROBE_TIMEOUT_MS = 2_000;

type Checks = Record<string, string>;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const wantsReadiness = url.searchParams.get('ready') === '1';

  if (!wantsReadiness) {
    return NextResponse.json({ status: 'ok' }, { headers: NO_STORE });
  }

  let env: ReturnType<typeof serverEnv>;
  try {
    env = serverEnv();
  } catch {
    return verdict({ env: 'fail' });
  }

  if (env.CONTENT_SOURCE === 'fixture') {
    return verdict({ env: 'ok', content: 'fixture' });
  }

  return verdict({ env: 'ok', ...(await probeKalEl()) });
}

async function probeKalEl(): Promise<Checks> {
  try {
    const transport = KalElTransport.fromEnv({ timeoutMs: PROBE_TIMEOUT_MS });
    const list = await transport.read(kalelArticleListSchema, {
      path: transport.sitePath('/articles'),
      query: { status: 'published', order: 'published', limit: 1, offset: 0 },
      noStore: true,
      retry: false,
    });
    return { kalel: 'ok', contract: typeof list.total === 'number' ? 'ok' : 'degraded' };
  } catch (err) {
    if (!isContentError(err)) return { kalel: 'fail' };
    if (err.kind === 'contract') return { kalel: 'ok', contract: 'fail' };
    if (err.kind === 'unauthorized') return { kalel: 'unauthorized' };
    // A status means the CMS answered and refused; none means it never answered.
    if (err.kind === 'unavailable' && err.status === undefined) return { kalel: 'unreachable' };
    return { kalel: 'fail' };
  }
}

function verdict(checks: Checks): Response {
  const ready = Object.values(checks).every((value) => value === 'ok' || value === 'fixture');
  return NextResponse.json(
    { status: ready ? 'ok' : 'degraded', checks },
    { status: ready ? 200 : 503, headers: NO_STORE },
  );
}
