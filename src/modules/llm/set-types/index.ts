import type { z } from 'zod';
import { strengthSetType } from './strength.set-type';

/**
 * Registry of supported workout types.
 *
 * To add one (e.g. cardio): create `<name>.set-type.ts` with
 * `defineSetType`, add it here, then fix the compile errors this causes in
 * exhaustive switches (the parse processor's set mapping) and tag catalogue
 * exercises with the new `setType`.
 */
export const SET_TYPES = [strengthSetType] as const;

type AnySetType = (typeof SET_TYPES)[number];

export type SetTypeName = AnySetType['name'];

export type ParsedSetOf<TName extends SetTypeName> = z.infer<
  Extract<AnySetType, { name: TName }>['setSchema']
>;

export function getSetType(name: SetTypeName): AnySetType {
  const definition = SET_TYPES.find((t) => t.name === name);
  if (!definition) throw new Error(`Unknown set type: ${name}`);
  return definition;
}

export type { SetTypeDefinition } from './set-type';
