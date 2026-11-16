import type { Topic } from './model';

export type LessonSource = { school: string; date?: string };
export type DatedLesson = LessonSource & { topic: string; previousTitle?: string };
export type DialogueLink = { id: string; title: string };

export function lessonSource(topic: Topic, dated: DatedLesson[]): LessonSource | undefined {
  if (topic.source) return topic.source;
  if (topic.language !== 'en') return undefined;
  const match = dated.find(entry => entry.topic === topic.title || entry.previousTitle === topic.title);
  return match && { school: match.school, date: match.date };
}

export function schoolLessonGroups(topics: Topic[], dated: DatedLesson[], dialogues: ReadonlyMap<string, DialogueLink[]>, query: string) {
  const groups = new Map<string, { topic: Topic; source?: LessonSource; matches: DialogueLink[] }[]>();
  const key = (value: string) => value.toLocaleLowerCase().replace(/ё/g, 'е');
  const search = key(query).trim().split(/\s+/).filter(Boolean);
  function includes(value: string) {
    const text = key(value);
    return search.every(term => text.includes(term));
  }
  for (const topic of topics) {
    const source = lessonSource(topic, dated);
    const school = source?.school ?? 'Темы без школы';
    const context = [school, topic.title, source?.date].join(' ');
    const matches = search.length ? (dialogues.get(topic.id) ?? []).filter(item =>
      search.some(term => key(item.title).includes(term)) && includes(context + ' ' + item.title)) : [];
    if (!includes(context) && !matches.length) continue;
    const lessons = groups.get(school) ?? [];
    lessons.push({ topic, source, matches });
    groups.set(school, lessons);
  }
  return [...groups].sort(([a], [b]) => a === 'Темы без школы' ? 1 : b === 'Темы без школы' ? -1 : a.localeCompare(b))
    .map(([school, lessons]) => ({ school, lessons: lessons.sort((a, b) => (b.source?.date ?? '').localeCompare(a.source?.date ?? '')) }));
}
