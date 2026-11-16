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
    const match = /^(\d{2}:\d{2}(?:[–-]\d{2}:\d{2})?)\s+·\s+(.+)$/.exec(header);
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

export const lessonPhrasesHash = '#materials/phrases';
export const phraseRetryDelay = 10 * 60_000;

export function phraseVocabularyId(card: ReturnType<typeof teacherPhraseCards>[number], language: string) {
  return wordId(language, card.phrase.replace(/[.?!]+$/, ''), card.meaning);
}

export function assessTeacherPhrase(study: Study, word: Word, outcome: 'independent' | 'retry', now: number) {
  if (study.language !== word.language || !study.words.some(entry => entry.id === word.id)) return study;
  const next = assess(study, word.id, outcome, now, 'spoken');
  if (outcome !== 'retry') return next;
  const result = next.results[word.id];
  const schedules = { ...result.schedules, spoken: { ...result.schedules!.spoken!, due: now + phraseRetryDelay } };
  return { ...next, results: { ...next.results, [word.id]: { ...result, schedules, due: Math.min(...Object.values(schedules).map(entry => entry.due)) } } };
}

export function teacherPhraseReviews(study: Study, now: number) {
  const words = new Map(study.words.filter(word => word.language === study.language).map(word =>
    [wordId(word.language, word.title, word.meaning), word]));
  const due = new Set<string>();
  const pending = new Map<string, number>();
  for (const source of study.resources) {
    if (source.language !== study.language || source.kind !== 'reading' || !source.title.startsWith('Реплики преподавателя ·')) continue;
    for (const card of teacherPhraseCards(source.text)) {
      const word = words.get(phraseVocabularyId(card, source.language));
      const result = word && study.results[word.id];
      if (!word || !result || lastSpoken(result).outcome !== 'retry') continue;
      const next = result.schedules?.spoken?.due ?? result.due;
      if (next <= now) due.add(word.id);
      else pending.set(word.id, next);
    }
  }
  return { due, pending };
}
