import type { ParsedSetOf, SetTypeName } from './set-types';

/** A catalogue entry the model may pick, with how its sets are recorded. */
export interface CatalogueExercise {
  name: string;
  setType: SetTypeName;
}

/**
 * One exercise from the log. `type` narrows `sets`, so consumers can
 * `switch (exercise.type)` and get a compile error when a type is added.
 */
export type ParsedExercise = {
  [TName in SetTypeName]: {
    type: TName;
    /** Exactly one of the catalogue names passed to the parser. */
    name: string;
    originalText: string;
    sets: ParsedSetOf<TName>[];
  };
}[SetTypeName];

export interface ParsedWorkout {
  exercises: ParsedExercise[];
  performedAt: string | null;
  durationMinutes: number | null;
}

export type ParseRejectionReason = 'not_a_workout' | 'unrecognized_exercises';

export type ParseOutcome =
  | { kind: 'ok'; workout: ParsedWorkout }
  | {
      kind: 'rejected';
      reason: ParseRejectionReason;
      /** Log fragments that matched no catalogue entry. */
      unrecognized?: string[];
    };

export interface ParseWorkoutOptions {
  /** The model may only pick exercises from this list. */
  catalogue: readonly CatalogueExercise[];
  /** Anchor for relative dates like "yesterday". */
  now: Date;
}

/**
 * Parses free-text workout descriptions into structured data.
 *
 * Implementations may be slow, rate-limited, and unreliable — callers should
 * treat failures as expected and run this off the request path. Throws
 * `LlmError` (provider failed) or `LlmOutputError` (reply unusable).
 */
export interface LlmService {
  parseWorkout(
    rawText: string,
    options: ParseWorkoutOptions,
  ): Promise<ParseOutcome>;
}

export const LLM_SERVICE = Symbol('LLM_SERVICE');
