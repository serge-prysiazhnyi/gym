import type { z } from 'zod';

/**
 * Everything the parser needs to know about one way of recording sets
 * (reps × weight, duration × distance, …).
 *
 * The schema, prompt and outcome mapping are all generated from these
 * definitions, so a new workout type is one new file plus a registry entry.
 */
export interface SetTypeDefinition<
  TName extends string = string,
  TSet extends z.ZodObject = z.ZodObject,
> {
  /** Discriminator the model writes in `exercises[].type`. */
  name: TName;
  /** Shown next to this group of exercises in the prompt. */
  description: string;
  /** Validates one set; also sent to the provider as JSON Schema. */
  setSchema: TSet;
  /** One set as the model should write it, for the prompt's reply shape. */
  setShape: string;
  /** Parsing rules specific to this kind of set. */
  promptRules: readonly string[];
  /** Post-validation clean-up, e.g. rounding to what the DB stores. */
  normalizeSet(set: z.infer<TSet>): z.infer<TSet>;
}

/** Identity helper that keeps the literal `name` and the set schema's type. */
export function defineSetType<TName extends string, TSet extends z.ZodObject>(
  definition: SetTypeDefinition<TName, TSet>,
): SetTypeDefinition<TName, TSet> {
  return definition;
}
