import type { TranscriptLine } from './lesson-transcript';

export const transcriptLoaders: Partial<Record<string, () => Promise<{ default: TranscriptLine[] }>>> = {
  'lesson-2026-11-20-nature-nurture': () => import('../../materials/en/lessons/teaching-house/nature-and-nurture/transcript.json'),
  'lesson-2026-11-17': () => import('../../materials/en/lessons/dc-public-library/conversation-and-values/transcript.json'),
  'lesson-2026-11-17-teaching-house': () => import('../../materials/en/lessons/teaching-house/climate-etiquette-and-ing/transcript.json')
};
