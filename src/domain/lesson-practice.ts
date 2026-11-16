import type { Resource } from './model';

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
