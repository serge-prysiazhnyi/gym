/**
 * Cheap, deterministic pre-filter for AI parse requests.
 *
 * Runs before anything is queued, so obvious junk and prompt-injection
 * attempts never reach (or pay for) the LLM. It is one layer of several: the
 * prompt treats the log as data, and the reply is validated against the
 * catalogue and again by `WorkoutsService.create()`.
 */

export type InputRejectionReason =
  'no_numbers' | 'suspicious_instructions' | 'links_or_code' | 'noise';

export type InputValidationResult =
  { ok: true } | { ok: false; reason: InputRejectionReason };

/** User-facing text per reason; deliberately vague about what was detected. */
export const INPUT_REJECTION_MESSAGES: Record<InputRejectionReason, string> = {
  no_numbers:
    'Include your sets, reps or weights as numbers, e.g. "squat 3x5 100kg".',
  suspicious_instructions:
    'This text cannot be processed. Describe only your workout.',
  links_or_code: 'Remove links and code from the workout description.',
  noise: 'This does not look like a workout description.',
};

const INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget)\b.{0,40}\b(previous|prior|above|earlier|all)\b.{0,20}\b(instructions?|prompts?|rules|messages?)\b/i,
  /\bsystem\s+prompt\b/i,
  /\byou\s+are\s+now\b/i,
  /\bact\s+as\s+(an?\s+)?(ai|assistant|system|developer)\b/i,
  /<\|\s*im_(start|end)\s*\|>/i,
  /^\s*(assistant|system|developer)\s*:/im,
  /<\s*\/?\s*workout_log\s*>/i,
];

const LINK_OR_CODE_PATTERNS = [
  /\bhttps?:\/\//i,
  /\bwww\.[a-z0-9-]+\.[a-z]{2,}/i,
  /```/,
];

// Real logs mix names with numbers ("squat 3x5 100kg" is ~60% letters).
const MIN_LETTER_RATIO = 0.25;
const MIN_DISTINCT_CHARS = 5;
const MAX_REPEATED_RUN = 20;

/** Strips characters that hide text from humans but not from the model. */
export function sanitizeWorkoutText(text: string): string {
  return (
    text
      .normalize('NFKC')
      .replace(/\r\n?/g, '\n')
      // Zero-width and invisible formatting characters
      .replace(/[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
      // Control characters, keeping tab and newline
      // eslint-disable-next-line no-control-regex -- stripping them is the point
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
  );
}

export function validateWorkoutInput(text: string): InputValidationResult {
  if (INJECTION_PATTERNS.some((p) => p.test(text))) {
    return { ok: false, reason: 'suspicious_instructions' };
  }

  if (LINK_OR_CODE_PATTERNS.some((p) => p.test(text))) {
    return { ok: false, reason: 'links_or_code' };
  }

  if (!/\d/.test(text)) {
    return { ok: false, reason: 'no_numbers' };
  }

  const visible = text.replace(/\s/g, '');
  const letters = visible.match(/\p{L}/gu)?.length ?? 0;
  if (
    letters / visible.length < MIN_LETTER_RATIO ||
    new Set(visible.toLowerCase()).size < MIN_DISTINCT_CHARS ||
    new RegExp(`(.)\\1{${MAX_REPEATED_RUN - 1},}`).test(visible)
  ) {
    return { ok: false, reason: 'noise' };
  }

  return { ok: true };
}
