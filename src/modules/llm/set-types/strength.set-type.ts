import { z } from 'zod';
import { defineSetType } from './set-type';

/** Reps, optionally with external load. Bodyweight sets have no weight. */
export const strengthSetType = defineSetType({
  name: 'strength',
  description: 'sets of reps, optionally with weight',
  setSchema: z.object({
    reps: z.number().int().min(1).max(1000),
    weightKg: z.number().min(0).max(1000).nullable(),
  }),
  setShape: '{"reps":integer,"weightKg":number|null}',
  promptRules: [
    'Expand shorthand into one entry per set: "3x10 @ 60kg" is three sets of 10 reps at 60 kg. "5/5/3 at 100" is three sets with 5, 5 and 3 reps.',
    '"weightKg" is in kilograms. Convert pounds (1 lb = 0.4536 kg) and round to 2 decimals. Use null for bodyweight or when no weight is given.',
  ],
  // CreateWorkoutSetDto allows at most 2 decimals.
  normalizeSet: (set) => ({
    ...set,
    weightKg:
      set.weightKg === null ? null : Math.round(set.weightKg * 100) / 100,
  }),
});
