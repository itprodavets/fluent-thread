import { assess, lastSpoken, wordId } from './model.ts';
import type { Resource, Study, Word } from './model';

export function lessonPractice(resources: Resource[], topicId: string) {
  const reading = (prefix: string) => resources.filter(item =>
    item.topicId === topicId && item.kind === 'reading' && item.title.startsWith(prefix) && item.text.trim());
  return {
    teacher: reading('Реплики преподавателя ·'),
    grammar: reading('Грамматика урока ·'),
    exercises: resources.filter(item => item.topicId === topicId && item.kind === 'exercise'
      && item.title.startsWith('Грамматика ·') && item.prompt && item.answer)
  };
}

export function teacherPhraseCards(text: string) {
  return text.split(/\n\s*\n/).flatMap(block => {
    const [header, translation, pattern, example] = block.trim().split('\n').map(line => line.trim());
    const match = /^(\d{2}:\d{2}(?::\d{2})?(?:[–-]\d{2}:\d{2}(?::\d{2})?)?)\s+·\s+(.+)$/.exec(header);
    if (!match || !translation?.startsWith('Перевод: ')) return [];
    return [{
      time: match[1],
      phrase: match[2],
      meaning: translation.slice('Перевод: '.length),
      pattern: pattern?.replace(/^Конструкция:\s*/, '') ?? '',
      example: example?.replace(/^Твой пример для практики:\s*/, '') ?? ''
    }];
  });
}

export type PhraseCard = { phrase: string; meaning: string; pattern: string; example: string; time?: string; topicId?: string; source?: string };

export const skillPhrasesHash = '#materials/skills';
export const lessonPhrasesHash = '#materials/phrases';
export const phraseRetryDelay = 10 * 60_000;

export function phraseVocabularyId(card: PhraseCard, language: string) {
  return wordId(language, card.phrase.trim().replace(/[.?!]+$/, ''), card.meaning.trim().replace(/[.?!]+$/, ''));
}

export function phraseWordKey(word: Word) {
  return phraseVocabularyId({ phrase: word.title, meaning: word.meaning, pattern: '', example: '' }, word.language);
}

export function assessTeacherPhrase(study: Study, word: Word, outcome: 'independent' | 'retry', now: number) {
  if (study.language !== word.language || !study.words.some(entry => entry.id === word.id)) return study;
  const next = assess(study, word.id, outcome, now, 'spoken');
  if (outcome !== 'retry') return next;
  const result = next.results[word.id];
  const schedules = { ...result.schedules, spoken: { ...result.schedules!.spoken!, due: now + phraseRetryDelay } };
  return { ...next, results: { ...next.results, [word.id]: { ...result, schedules, due: Math.min(...Object.values(schedules).map(entry => entry.due)) } } };
}

export function assessPhraseCard(study: Study, card: PhraseCard, language: string, outcome: 'independent' | 'retry', now: number) {
  if (study.language !== language) return study;
  const id = phraseVocabularyId(card, language);
  const existing = study.words.find(word => word.language === language && phraseWordKey(word) === id);
  if (!existing && !card.topicId) return study;
  const word = existing ?? { id, language, title: card.phrase.replace(/[.?!]+$/, ''), meaning: card.meaning, example: card.example };
  const next = {
    ...study, words: existing ? study.words : [...study.words, word],
    topics: card.topicId ? study.topics.map(topic => topic.id === card.topicId && !topic.links.includes(word.id)
      ? { ...topic, links: [...topic.links, word.id] } : topic) : study.topics
  };
  return assessTeacherPhrase(next, word, outcome, now);
}

export function phraseReviews(study: Study, cards: PhraseCard[], now: number) {
  const ids = new Set(cards.map(card => phraseVocabularyId(card, study.language)));
  const due = new Set<string>();
  const pending = new Map<string, number>();
  for (const word of study.words) {
    if (word.language !== study.language || !study.results[word.id] || !ids.has(phraseWordKey(word))) continue;
    const result = study.results[word.id];
    if (lastSpoken(result).outcome !== 'retry') continue;
    const next = result.schedules?.spoken?.due ?? result.due;
    if (next <= now) due.add(word.id);
    else pending.set(word.id, next);
  }
  return { due, pending };
}

export function teacherPhraseReviews(study: Study, now: number) {
  const cards = study.resources.filter(source => source.language === study.language &&
    source.kind === 'reading' && source.title.startsWith('Реплики преподавателя ·')).flatMap(source => teacherPhraseCards(source.text));
  return phraseReviews(study, cards, now);
}
