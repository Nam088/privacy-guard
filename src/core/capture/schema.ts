import { z } from 'zod';

export const describedValueSchema = z.object({
  type: z.string(),
  byteLength: z.number(),
});

export const observedEventSchema = z.object({
  seq: z.number(),
  at: z.number(),
  kind: z.string(),
  target: z.string(),
  frameUrl: z.string().optional(),
  value: describedValueSchema.optional(),
  payload: z.unknown().optional(),
});

export const captureListSchema = z.array(observedEventSchema);
