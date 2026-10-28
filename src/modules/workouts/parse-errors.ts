import { UnrecoverableError } from 'bullmq';

/**
 * User-safe outcome codes for a failed parse job. They are what the client
 * sees, so they never carry raw provider or model output.
 */
export type ParseErrorCode =
  | 'NOT_A_WORKOUT'
  | 'UNRECOGNIZED_EXERCISES'
  | 'PARSE_FAILED'
  | 'LLM_UNAVAILABLE';

/**
 * A parse failure that retrying won't fix. Extends `UnrecoverableError`, so
 * BullMQ fails the job at once; the message is the code, which is what ends
 * up in the job's `failedReason`.
 */
export class ParseJobError extends UnrecoverableError {
  constructor(
    readonly code: ParseErrorCode,
    /** Safe to show the user, e.g. the unrecognised log fragments. */
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
  }
}
