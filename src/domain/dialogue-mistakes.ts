import { reviewRuleUsed } from './skill-answer.ts';
import type { Correction } from './skill-answer';
import type { Study } from './model';

export const dialogueMistakesHash = '#materials/mistakes';
export const dialogueRetryDelay = 10 * 60_000;
const day = 86_400_000;
const intervals = [1, 3, 7, 14, 30];

export type DialogueScenario = {
  skillId: string;
  school: string;
  title: string;
  prompt: string;
  answer: string;
  role: { line: string; patterns: string[] };
  phrases: { phrase: string; meaning: string }[];
};

export type DialogueMistake = {
  id: string;
  scenario: DialogueScenario;
  correction: Correction;
  corrections: Correction[];
  original: string;
  due: number;
  level: number;
  last?: { answer: string; result: 'fixed' | 'retry'; assessment?: import('./model').Outcome };
  reviewMode?: 'self-check';
  checklist?: string[];
  source?: { lessonId: string; topicId: string; time: string; kind: string };
};

function mistakeId(scenario: DialogueScenario, rule: string) {
  return JSON.stringify([scenario.skillId, scenario.school, scenario.title, rule]);
}

export function dialogueMistakes(study: Study, now: number) {
  const all = study.language === 'en' ? Object.values(study.dialogueMistakes ?? {}).sort((a, b) => a.due - b.due) : [];
  return { all, due: all.filter(card => card.due <= now) };
}

export function mistakeReviewMoved(study: Study, id: string, now: number) {
  const card = study.dialogueMistakes?.[id];
  return !card || card.due > now;
}

export function saveDialogueMistakes(study: Study, scenario: DialogueScenario, answer: string, corrections: Correction[], now: number, except?: string): Study {
  if (!corrections.length) return study;
  const next = { ...study.dialogueMistakes };
  let changed = false;
  const byRule = new Map<string, Correction[]>();
  for (const correction of corrections) {
    const group = byRule.get(correction.rule) ?? [];
    group.push(correction);
    byRule.set(correction.rule, group);
  }
  for (const [rule, group] of byRule) {
    const id = mistakeId(scenario, rule);
    if (id === except) continue;
    const previous = next[id];
    if (previous?.original === answer && previous.level === 0) continue;
    next[id] = { id, scenario, correction: group[0], corrections: group, original: answer, due: previous?.level === 0 ? previous.due : now + dialogueRetryDelay,
      level: 0, last: previous?.last };
    changed = true;
  }
  return changed ? { ...study, dialogueMistakes: next } : study;
}

export function dialogueReviewOutcome(card: DialogueMistake, answer: string, corrections: Correction[]) {
  if (corrections.some(issue => issue.rule === card.correction.rule)) return 'retry';
  return reviewRuleUsed(answer, card.correction) ? 'fixed' : 'try-construction';
}

export function reviewDialogueMistake(study: Study, id: string, answer: string, corrections: Correction[], now: number): Study {
  const card = study.dialogueMistakes?.[id];
  if (!card) return study;
  const next = saveDialogueMistakes(study, card.scenario, answer, corrections, now, id);
  const result = dialogueReviewOutcome(card, answer, corrections);
  if (result === 'try-construction' || (card.level > 0 || card.last?.answer === answer) && card.due > now) return next;
  const level = result === 'fixed' ? card.level + 1 : 0;
  const delay = result === 'retry' ? dialogueRetryDelay : intervals[Math.min(level - 1, intervals.length - 1)] * day;
  return { ...next, dialogueMistakes: { ...next.dialogueMistakes,
    [id]: { ...card, due: now + delay, level, last: { answer, result } }
  } };
}
