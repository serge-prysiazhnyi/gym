import { z } from 'zod';
import type { CatalogueExercise } from './llm.service';
import { SET_TYPES } from './set-types';

export const UNKNOWN_EXERCISE = 'UNKNOWN';
export const UNKNOWN_TYPE = 'unknown';

export const PARSE_LIMITS = {
  maxExercises: 30,
  maxSetsPerExercise: 50,
  // Mirrors CreateWorkoutSetDto.setNumber's max, so a parse never fails on save.
  maxTotalSets: 100,
} as const;

/**
 * Builds the reply schema for one catalogue.
 *
 * Each exercise is a variant discriminated by `type`, with the names of that
 * type as an enum and that type's set schema, so the model can't attach
 * cardio sets to a strength exercise. Only types present in the catalogue are
 * included. The same schema is sent to the provider as JSON Schema and used
 * to validate the reply, so the two can never drift apart.
 */
export function buildWorkoutParseSchema(
  catalogue: readonly CatalogueExercise[],
) {
  const originalText = z.string().max(200);

  const variants = SET_TYPES.flatMap((setType) => {
    const names = [
      ...new Set(
        catalogue.filter((e) => e.setType === setType.name).map((e) => e.name),
      ),
    ];
    if (names.length === 0) return [];

    return [
      z.object({
        type: z.literal(setType.name),
        name: z.enum(names as [string, ...string[]]),
        originalText,
        sets: z
          .array(setType.setSchema)
          .min(1)
          .max(PARSE_LIMITS.maxSetsPerExercise),
      }),
    ];
  });

  const unknown = z.object({
    type: z.literal(UNKNOWN_TYPE),
    name: z.literal(UNKNOWN_EXERCISE),
    originalText,
  });

  const exercise = z.discriminatedUnion('type', [unknown, ...variants]);

  return z
    .object({
      status: z.enum(['ok', 'not_a_workout']),
      exercises: z.array(exercise).max(PARSE_LIMITS.maxExercises),
      performedAt: z
        .string()
        .refine((v) => !Number.isNaN(Date.parse(v)), 'Must be ISO 8601')
        .nullable(),
      durationMinutes: z.number().int().min(1).max(1440).nullable(),
    })
    .superRefine((value, ctx) => {
      if (value.status === 'ok' && value.exercises.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['exercises'],
          message: 'Must contain at least one exercise when status is "ok"',
        });
      }

      const totalSets = value.exercises.reduce(
        (n, e) => n + ('sets' in e ? e.sets.length : 0),
        0,
      );
      if (totalSets > PARSE_LIMITS.maxTotalSets) {
        ctx.addIssue({
          code: 'custom',
          path: ['exercises'],
          message: `Must contain at most ${PARSE_LIMITS.maxTotalSets} sets in total`,
        });
      }
    });
}

export type WorkoutParseSchema = ReturnType<typeof buildWorkoutParseSchema>;
export type WorkoutParseReply = z.infer<WorkoutParseSchema>;

/**
 * JSON Schema for the provider. Drops `$schema` (some APIs reject it) and
 * rewrites `oneOf` to `anyOf`: strict structured output only accepts
 * `anyOf`, and our variants are disjoint by `type`, so the meaning is equal.
 */
export function toProviderJsonSchema(
  schema: WorkoutParseSchema,
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...rest } = z.toJSONSchema(schema);
  return renameKey(rest, 'oneOf', 'anyOf') as Record<string, unknown>;
}

function renameKey(value: unknown, from: string, to: string): unknown {
  if (Array.isArray(value)) return value.map((v) => renameKey(v, from, to));
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k === from ? to : k,
      renameKey(v, from, to),
    ]),
  );
}
