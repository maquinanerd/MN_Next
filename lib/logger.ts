import 'server-only';

/**
 * Structured logging, for routes and pages.
 *
 * The implementation lives in `@mn/content/logger`, next to the transport that needs it
 * wired in by default; this re-export keeps every existing import site unchanged.
 */
export { correlationId, logger, type LogLevel } from '@mn/content/logger';
