import catalog from '../../materials/en/lessons/catalog.json';

const loaders: Record<string, () => Promise<{ default: string }>> = {
  "ace-tefl/report-opening-sentences": () => import('../../materials/en/lessons/ace-tefl/report-opening-sentences/lesson.json?raw'),
  "ih-bangkok/technology-breaks-and-celebration-plans": () => import('../../materials/en/lessons/ih-bangkok/technology-breaks-and-celebration-plans/lesson.json?raw'),
  "ace-tefl/reports-and-mirror-town": () => import('../../materials/en/lessons/ace-tefl/reports-and-mirror-town/lesson.json?raw'),
  "dc-teacher-training/crime-punishment-and-time": () => import('../../materials/en/lessons/dc-teacher-training/crime-punishment-and-time/lesson.json?raw'),
  "ace-tefl/clarifying-meaning": () => import('../../materials/en/lessons/ace-tefl/clarifying-meaning/lesson.json?raw'),
  "stafford-house/wolves-and-eco-homes": () => import('../../materials/en/lessons/stafford-house/wolves-and-eco-homes/lesson.json?raw'),
  "ace-tefl/future-plans": () => import('../../materials/en/lessons/ace-tefl/future-plans/lesson.json?raw'),
  "dc-teacher-training/responses-and-opinions": () => import('../../materials/en/lessons/dc-teacher-training/responses-and-opinions/lesson.json?raw'),
  "dc-teacher-training/get-and-interviews": () => import('../../materials/en/lessons/dc-teacher-training/get-and-interviews/lesson.json?raw'),
  "dc-public-library/conversation-and-values": () => import('../../materials/en/lessons/dc-public-library/conversation-and-values/lesson.json?raw'),
  "teaching-house/climate-etiquette-and-ing": () => import('../../materials/en/lessons/teaching-house/climate-etiquette-and-ing/lesson.json?raw'),
  "dc-teacher-training/relationships-and-happiness": () => import('../../materials/en/lessons/dc-teacher-training/relationships-and-happiness/lesson.json?raw'),
  "teaching-house/generations-and-olympics": () => import('../../materials/en/lessons/teaching-house/generations-and-olympics/lesson.json?raw'),
  "uuca-esol/workplace-requests": () => import('../../materials/en/lessons/uuca-esol/workplace-requests/lesson.json?raw'),
  "dc-public-library/learning-and-speaking-confidence": () => import('../../materials/en/lessons/dc-public-library/learning-and-speaking-confidence/lesson.json?raw'),
  "dc-public-library/culture-and-values": () => import('../../materials/en/lessons/dc-public-library/culture-and-values/lesson.json?raw'),
  "marin-county-library/superstitions-and-traditions": () => import('../../materials/en/lessons/marin-county-library/superstitions-and-traditions/lesson.json?raw'),
  "teaching-house/certainty-and-travel": () => import('../../materials/en/lessons/teaching-house/certainty-and-travel/lesson.json?raw'),
  "ace-tefl/memory-and-verb-patterns": () => import('../../materials/en/lessons/ace-tefl/memory-and-verb-patterns/lesson.json?raw'),
  "teaching-house/nature-and-nurture": () => import('../../materials/en/lessons/teaching-house/nature-and-nurture/lesson.json?raw'),
};

export const storyHourLesson = { id: 'esl-bits/story-of-an-hour', language: 'en', title: 'The Story of an Hour · свобода и неожиданные чувства', load: () => import('../../materials/en/resources/esl-bits/story-of-an-hour/lesson.json?raw') };

export const bundledLessons = [
  ...[...catalog].sort((a, b) => b.date.localeCompare(a.date)).map(lesson => ({
    id: lesson.id, language: lesson.language, title: lesson.topic, load: loaders[lesson.id]
  })),
  storyHourLesson
];
