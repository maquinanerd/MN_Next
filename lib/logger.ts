import 'server-only';
import { redact } from '@mn/content/env';

/**
 * Structured logging.
 *
 * One JSON object per line, every value passed through `redact()` on the way out. There
 * is no `console.log(err)` anywhere in the application: an upstream error string can
 * echo a request header, and a bearer token in a log file is a leaked credential.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')) as
    | Level
    | 'silent';
  if (configured === 'silent') return 100;
  return ORDER[configured] ?? 20;
}

function scrub(value: unknown): unknown {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrub(v)]));
  }
  return value;
}

function emit(level: Level, event: string, meta: Record<string, unknown> = {}): void {
  if (ORDER[level] < threshold()) return;
  const line = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...(scrub(meta) as Record<string, unknown>),
  });
  if (level === 'error') console.error(line);
  else console.warn(line);
}

export const logger = {
  debug: (event: string, meta?: Record<string, unknown>) => emit('debug', event, meta),
  info: (event: string, meta?: Record<string, unknown>) => emit('info', event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => emit('warn', event, meta),
  error: (event: string, meta?: Record<string, unknown>) => emit('error', event, meta),
};

/** Correlation id for a request, reusing an upstream one when present. */
export function correlationId(headers: Headers): string {
  const upstream = headers.get('x-correlation-id') ?? headers.get('x-request-id');
  if (upstream && /^[A-Za-z0-9._-]{8,128}$/.test(upstream)) return upstream;
  return crypto.randomUUID();
}
