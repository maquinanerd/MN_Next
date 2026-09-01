/**
 * Normalised content errors.
 *
 * Routes switch on `kind`, never on an HTTP status from the CMS. `NotFound` is editorial
 * (`notFound()`); `Unavailable` and `Contract` are dependency failures that degrade to a
 * logged 503 for essential content and to `null` for optional modules.
 */

export type ContentErrorKind =
  /** The CMS answered, and the thing does not exist. */
  | 'not_found'
  /** The CMS could not be reached, timed out, or answered 5xx. */
  | 'unavailable'
  /** The CMS answered, but the payload does not satisfy the agreed schema. */
  | 'contract'
  /** The service credential was rejected. Never retried. */
  | 'unauthorized'
  /** The caller asked for something the adapter cannot express. */
  | 'unsupported';

export class ContentError extends Error {
  readonly kind: ContentErrorKind;
  readonly correlationId: string | undefined;
  readonly status: number | undefined;
  readonly detail: string | undefined;

  constructor(
    kind: ContentErrorKind,
    message: string,
    options: { correlationId?: string; status?: number; detail?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ContentError';
    this.kind = kind;
    this.correlationId = options.correlationId;
    this.status = options.status;
    this.detail = options.detail;
  }

  static notFound(what: string, correlationId?: string): ContentError {
    return new ContentError('not_found', `${what} not found`, { correlationId, status: 404 });
  }

  static unavailable(message: string, options: { correlationId?: string; status?: number; cause?: unknown } = {}) {
    return new ContentError('unavailable', message, options);
  }

  static contract(message: string, options: { correlationId?: string; detail?: string } = {}) {
    return new ContentError('contract', message, options);
  }
}

export function isContentError(err: unknown): err is ContentError {
  return err instanceof ContentError;
}

/** True when the failure is a dependency problem rather than a missing document. */
export function isDependencyFailure(err: unknown): boolean {
  return isContentError(err) && err.kind !== 'not_found';
}
