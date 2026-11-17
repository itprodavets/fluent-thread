import type { TranscriptLine } from './lesson-transcript';

export const transcriptLoaders: Partial<Record<string, () => Promise<{ default: TranscriptLine[] }>>> = {
  'lesson-2026-11-17': () => import('../../materials/2026-11-17/transcript.json'),
  'lesson-2026-11-17-teaching-house': () => import('../../materials/2026-11-17/teaching-house-transcript.json')
};
