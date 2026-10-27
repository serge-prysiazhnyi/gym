export type LlmErrorKind = 'transient' | 'permanent';

/**
 * A provider call failed.
 *
 * `transient` (429, 5xx, timeout, network) is worth retrying later;
 * `permanent` (400, 401, 403, unknown model) will fail the same way again.
 */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: LlmErrorKind,
    readonly details: { provider: string; model: string; status?: number },
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'LlmError';
  }
}

/**
 * The provider answered, but the reply was not valid workout JSON even after
 * the repair retry. Retrying the whole job is unlikely to help.
 */
export class LlmOutputError extends Error {
  constructor(
    message: string,
    readonly issues: string,
  ) {
    super(message);
    this.name = 'LlmOutputError';
  }
}
