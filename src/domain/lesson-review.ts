import type { PracticeResult, Study, Topic, Word } from './model';

export const lessonReviewHash = '#today/review';

export function lessonReviewDue(result?: PracticeResult) {
  return result?.schedules?.spoken?.due ?? (!result?.mode || result.mode === 'spoken' ? result?.due : undefined);
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
  return { due, nextAt };
}
