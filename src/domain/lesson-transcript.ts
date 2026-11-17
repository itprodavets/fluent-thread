import { normalize, upsert, wordId } from './model.ts';
import type { Study } from './model';

export type TranscriptLine = {
  start: number;
  end: number;
  en: string;
  ru: string;
  teacher?: boolean | string;
};

export type PhraseAudioSource = Pick<TranscriptLine, 'start' | 'end' | 'en' | 'ru'> & { recordingKey: string };

export function phraseSource(recordingKey: string, { start, end, en, ru }: TranscriptLine): PhraseAudioSource {
  return { recordingKey, start, end, en, ru };
}

export function matchPhraseSource(recordingKey: string, lines: TranscriptLine[], title: string, example: string) {
  const textKey = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, ' ').trim();
  const phrase = textKey(title);
  if (!phrase) return;
  const context = textKey(example);
  const exact = lines.filter(line => textKey(line.en) === phrase || (context && textKey(line.en) === context
    && (' ' + context + ' ').includes(' ' + phrase + ' ')));
  const matches = exact.length || phrase.split(' ').length < 4 ? exact
    : lines.filter(line => (' ' + textKey(line.en) + ' ').includes(' ' + phrase + ' '));
  const candidate = matches.length === 1 ? matches[0] : undefined;
  return candidate && phraseSource(recordingKey, candidate);
}

export function recordingTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = Math.floor(seconds) % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':');
}

export function saveTranscriptPhrase(study: Study, input: {
  language: string;
  title: string;
  meaning: string;
  example: string;
  level: 'active' | 'passive';
  topicId?: string;
  audioSource?: PhraseAudioSource;
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
    words: upsert(study.words, input.audioSource ? { ...word, audioSource: input.audioSource } : word),
    topics: study.topics.map(topic => topic.id === topicId && topic.language === language && !topic.links.includes(word.id)
      ? { ...topic, links: [...topic.links, word.id] } : topic)
  };
}
