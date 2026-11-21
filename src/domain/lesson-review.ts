import { materialReviewDue, reviewResources } from './material-review.ts';
import type { PracticeResult, Study, Topic, Word } from './model';
import { dialogueMistakes } from './dialogue-mistakes.ts';

export const lessonReviewHash = '#today/review';

export function lessonReviewDue(result?: PracticeResult) {
  return materialReviewDue(result);
}

export function lessonReviewQueue(study: Study, now: number) {
  const topicsByWord = new Map<string, Topic[]>();
  for (const topic of study.topics) {
    if (topic.language !== study.language) continue;
    for (const id of new Set(topic.links)) {
      const topics = topicsByWord.get(id) ?? [];
      topics.push(topic);
      topicsByWord.set(id, topics);
    }
  }

  const due: { word: Word; topics: Topic[]; at: number }[] = [];
  let nextAt: number | undefined;
  for (const word of study.words) {
    const topics = topicsByWord.get(word.id);
    if (word.language !== study.language || !topics || !word.meaning.trim()) continue;
    const at = lessonReviewDue(study.results[word.id]);
    if (at === undefined || !Number.isFinite(at)) continue;
    if (at <= now) due.push({ word, topics, at });
    else if (nextAt === undefined || at < nextAt) nextAt = at;
  }

  due.sort((a, b) => a.at - b.at);
  const materials = reviewResources(study).flatMap(resource => {
    const at = materialReviewDue(study.results[resource.id]);
    if (at === undefined || !Number.isFinite(at)) return [];
    if (at > now) { if (nextAt === undefined || at < nextAt) nextAt = at; return []; }
    return [{ resource, at, topics: study.topics.filter(topic => topic.language === study.language && topic.id === resource.topicId) }];
  }).sort((a,b) => a.at-b.at);
  const mistakes = dialogueMistakes(study, now).all.flatMap(mistake => {
    if (!Number.isFinite(mistake.due)) return [];
    if (mistake.due > now) { if (nextAt === undefined || mistake.due < nextAt) nextAt = mistake.due; return []; }
    return [{ mistake, at: mistake.due, topics: study.topics.filter(topic =>
      topic.language === study.language && topic.id === mistake.source?.topicId) }];
  });
  const all = [...due.map(item => ({ ...item, kind: 'word' as const })),
    ...materials.map(item => ({ ...item, kind: 'material' as const })),
    ...mistakes.map(item => ({ ...item, kind: 'mistake' as const }))].sort((a,b) => a.at-b.at);
  return { due, materials, mistakes, all, nextAt };
}
