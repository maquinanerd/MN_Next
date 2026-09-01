import { NextResponse } from 'next/server';
import { serverEnv } from '@mn/content/env';

/**
 * Liveness and readiness.
 *
 * `/api/health` answers as long as the process is up - it is what a restart policy
 * watches, and it must not fail because a dependency is down.
 *
 * `?ready=1` is readiness: it additionally requires a valid environment and a reachable
 * Kal El. A load balancer uses that one to decide whether to send traffic here.
 *
 * Neither response names a host, a token or a version an attacker could fingerprint.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'cache-control': 'no-store' };

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
    return NextResponse.json({ status: 'degraded', checks: { env: 'fail' } }, { status: 503, headers: NO_STORE });
  }

  if (env.CONTENT_SOURCE === 'fixture') {
    return NextResponse.json({ status: 'ok', checks: { env: 'ok', content: 'fixture' } }, { headers: NO_STORE });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_000);
  try {
    const res = await fetch(`${env.KAL_EL_BASE_URL}/health`, { cache: 'no-store', signal: controller.signal });
    const ok = res.ok;
    return NextResponse.json(
      { status: ok ? 'ok' : 'degraded', checks: { env: 'ok', kalel: ok ? 'ok' : 'fail' } },
      { status: ok ? 200 : 503, headers: NO_STORE },
    );
  } catch {
    return NextResponse.json(
      { status: 'degraded', checks: { env: 'ok', kalel: 'unreachable' } },
      { status: 503, headers: NO_STORE },
    );
  } finally {
    clearTimeout(timer);
  }
}
