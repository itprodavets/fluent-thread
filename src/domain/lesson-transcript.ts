import { normalize, upsert, wordId } from './model.ts';
import type { Study } from './model';

export type TranscriptLine = {
  start: number;
  end: number;
  en: string;
  ru: string;
  teacher?: boolean | string;
};

export function recordingTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = Math.floor(seconds) % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':');
}

export function lineAtTime(lines: TranscriptLine[], position: number) {
  for (let index = lines.length - 1; index >= 0; index--) {
    const { start, end } = lines[index];
    if (start <= position && position < end) return index;
  }
  return -1;
}

export function saveTranscriptPhrase(study: Study, input: {
  language: string;
  title: string;
  meaning: string;
  example: string;
  level: 'active' | 'passive';
  topicId?: string;
}): Study {
  const { language, topicId } = input;
  const title = input.title.trim();
  const meaning = input.meaning.trim();
  if (!title || !meaning) return study;
  const key = (value: string) => normalize(value, language).replace(/[’‘]/g, "'").replace(/[.!?…]+$/u, '');
  const existing = study.words.find(word => word.language === language && key(word.title) === key(title)
    && key(word.meaning) === key(meaning));
  const word = existing ? { ...existing, vocabularyLevel: input.level } : {
    id: wordId(language, title, meaning), language, title, meaning, example: input.example, vocabularyLevel: input.level
  };
  return {
    ...study,
    words: upsert(study.words, word),
    topics: study.topics.map(topic => topic.id === topicId && topic.language === language && !topic.links.includes(word.id)
      ? { ...topic, links: [...topic.links, word.id] } : topic)
  };
}
