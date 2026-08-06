export interface ParsedSet {
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
}

export interface ParsedWorkout {
  sets: ParsedSet[];
}

/**
 * Parses free-text workout descriptions into structured data.
 *
 * Implementations may be slow, rate-limited, and unreliable — callers should
 * treat failures as expected and run this off the request path.
 */
export interface LlmService {
  parseWorkout(rawText: string): Promise<ParsedWorkout>;
}

export const LLM_SERVICE = Symbol('LLM_SERVICE');
