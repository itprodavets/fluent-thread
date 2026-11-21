import type { Outcome, Study } from './model';
import type { DialogueMistake } from './dialogue-mistakes';

export type LessonMistakePack = {
  id: string; recordingKey: string; school: string; date: string; notice: string;
  cards: { id: string; time: string; title: string; original: string; corrected: string;
    reason: string; partner: string; prompt: string; checklist: string[]; kind: string }[];
};

export function availableLessonMistakes(study: Study, packs: LessonMistakePack[]) {
  if (study.language !== 'en') return [];
  return packs.flatMap(pack => {
    const topic = study.topics.find(topic => topic.language === 'en' && study.resources.some(resource =>
      resource.language === 'en' && resource.topicId === topic.id && resource.title === 'Запись урока с таймкодами'
      && resource.text.startsWith('Recording: ' + pack.recordingKey + '\n')));
    if (!topic) return [];
    return pack.cards.flatMap(example => {
      const id = JSON.stringify(['lesson-mistake', pack.id, example.id]);
      return study.dialogueMistakes?.[id] ? [] : [{ id, example, pack, topic }];
    });
  });
}

export function addLessonMistakes(study: Study, packs: LessonMistakePack[], now: number): Study {
  const available = availableLessonMistakes(study, packs);
  if (!available.length) return study;
  const next = { ...study.dialogueMistakes };
  for (const { id, example, pack, topic } of available) {
    const correction = { rule: 'lesson:' + example.id, before: example.original, after: example.corrected, reason: example.reason };
    next[id] = { id, original: example.original, correction, corrections: [correction], due: now, level: 0,
      reviewMode: 'self-check', checklist: example.checklist,
      source: { lessonId: pack.id, topicId: topic.id, time: example.time, kind: example.kind },
      scenario: { skillId: 'lesson-mistake', school: pack.school, title: example.title,
        prompt: example.prompt, answer: example.corrected,
        role: { line: example.partner, patterns: [] }, phrases: [] }
    } satisfies DialogueMistake;
  }
  return { ...study, dialogueMistakes: next };
}

const day = 86_400_000;
const intervals = [1, 3, 7, 14, 30];
/** Explicit self-assessment of a free paraphrase, not an automated grammar verdict. */
export function assessLessonMistake(study: Study, id: string, answer: string, outcome: Outcome, now: number): Study {
  const card = study.dialogueMistakes?.[id];
  if (study.language !== 'en' || !card || card.reviewMode !== 'self-check' || !answer.trim()
    || answer.length > 6000 || (card.last && card.due > now)) return study;
  const level = outcome === 'retry' ? 0 : outcome === 'assisted' ? Math.max(1, card.level) : card.level + 1;
  const delay = outcome === 'retry' ? 600_000 : outcome === 'assisted' ? day : intervals[Math.min(level - 1, intervals.length - 1)] * day;
  return { ...study, dialogueMistakes: { ...study.dialogueMistakes,
    [id]: { ...card, level, due: now + delay, last: { answer: answer.trim(), result: outcome === 'retry' ? 'retry' : 'fixed', assessment: outcome } }
  } };
}
