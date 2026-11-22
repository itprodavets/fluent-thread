import type { TranscriptLine } from './lesson-transcript';

export const transcriptLoaders: Partial<Record<string, () => Promise<{ default: TranscriptLine[] }>>> = {
  'lesson-2026-11-22-adventure-travel': () => import('../../materials/en/lessons/unconfirmed/adventure-medicine-and-ai/transcript.json'),
  'lesson-2026-11-22-ih-scientists-photos': () => import('../../materials/en/lessons/ih-bangkok/scientists-and-photography-compliments/transcript.json'),
  'lesson-2026-11-21-uuca-food-project': () => import('../../materials/en/lessons/uuca-esol/food-traditions-and-sharing-a-project/transcript.json'),
  'lesson-2026-11-21-ih-bangkok': () => import('../../materials/en/lessons/ih-bangkok/technology-breaks-and-celebration-plans/transcript.json'),
  'lesson-2026-11-21-ace-reports-mirrors': () => import('../../materials/en/lessons/ace-tefl/reports-and-mirror-town/transcript.json'),
  'lesson-2026-11-20-dc-crime-time': () => import('../../materials/en/lessons/dc-teacher-training/crime-punishment-and-time/transcript.json'),
  'lesson-2026-11-20-ace-clarifying': () => import('../../materials/en/lessons/ace-tefl/clarifying-meaning/transcript.json'),
  'lesson-2026-11-20-nature-nurture': () => import('../../materials/en/lessons/teaching-house/nature-and-nurture/transcript.json'),
  'lesson-2026-11-17': () => import('../../materials/en/lessons/dc-public-library/conversation-and-values/transcript.json'),
  'lesson-2026-11-17-teaching-house': () => import('../../materials/en/lessons/teaching-house/climate-etiquette-and-ing/transcript.json')
};
