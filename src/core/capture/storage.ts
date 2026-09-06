import { storage } from '#imports';
import type { ObservedEvent } from '@/observe/types';
import { captureListSchema, observedEventSchema } from './schema';

export const CAPTURE_LIMIT = 500;

const capturesItem = storage.defineItem<ObservedEvent[]>('local:captures', {
  fallback: [],
  version: 1,
});

export async function readCaptures(): Promise<ObservedEvent[]> {
  const parsed = captureListSchema.safeParse(await capturesItem.getValue());
  return parsed.success ? (parsed.data as ObservedEvent[]) : [];
}

export async function appendCapture(event: ObservedEvent): Promise<void> {
  observedEventSchema.parse(event);
  const current = await readCaptures();
  const next = [...current, event];
  await capturesItem.setValue(next.slice(-CAPTURE_LIMIT));
}

export async function clearCaptures(): Promise<void> {
  await capturesItem.setValue([]);
}

export async function exportCaptures(): Promise<string> {
  return JSON.stringify(await readCaptures(), null, 2);
}
