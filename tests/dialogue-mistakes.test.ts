import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dialogueMistakes, dialogueRetryDelay, dialogueReviewOutcome, reviewDialogueMistake, saveDialogueMistakes } from '../src/domain/dialogue-mistakes.ts';
import { inspectSkillAnswer } from '../src/domain/skill-answer.ts';

const initial = { language: 'en', languages: { en: {} }, topics: [], words: [], resources: [], results: {} };
const scenario = {
  skillId: 'polite-questions', title: 'Getting a lift', school: 'ACE TEFL',
  role: { line: 'I’m driving past your area.', patterns: ['Would you mind'] },
  prompt: 'Ask for a lift.', answer: 'Would you mind picking me up?', phrases: []
};
const check = (answer: string) => inspectSkillAnswer(answer, scenario.skillId, scenario.role.patterns).corrections;
const now = 1_800_000_000_000;

test('errors keep the original situation and become due after ten minutes', () => {
  const bad = 'Would you mind pick me up? Would you mind give me a lift? Could you tell me where is it?';
  const study = saveDialogueMistakes(initial, scenario, bad, check(bad), now);
  const cards = dialogueMistakes(study, now).all;
  const mind = cards.find(card => card.correction.rule === 'mind-ing')!;
  assert.equal(cards.length, 2);
  assert.equal(mind.original, bad);
  assert.equal(mind.corrections.length, 2);
  assert.equal(mind.scenario.role.line, scenario.role.line);
  assert.equal(dialogueMistakes(study, now + dialogueRetryDelay - 1).due.length, 0);
  assert.equal(dialogueMistakes(study, now + dialogueRetryDelay).due.length, 2);
  assert.equal(saveDialogueMistakes(study, scenario, bad, check(bad), now + 1000), study);
  assert.equal(saveDialogueMistakes(initial, scenario, 'Tell me where it is.', check('Tell me where it is.'), now), initial);
});

test('a fresh answer must use the target; a new correct sentence advances the interval', () => {
  const old = 'Would you mind pick me up?';
  const study = saveDialogueMistakes(initial, scenario, old, check(old), now);
  const due = now + dialogueRetryDelay;
  const card = dialogueMistakes(study, due).due[0];
  assert.equal(dialogueReviewOutcome(card, 'Could you give me a lift?', []), 'try-construction');
  assert.equal(dialogueReviewOutcome(card, 'Would you mind something?', []), 'try-construction');
  assert.equal(reviewDialogueMistake(study, card.id, 'Hello!', [], due), study);
  const retry = reviewDialogueMistake(study, card.id, old, check(old), due);
  assert.equal(retry.dialogueMistakes![card.id].due, due + dialogueRetryDelay);
  const attempt = 'Would you mind giving me a lift from the station?';
  const fixed = reviewDialogueMistake(retry, card.id, attempt, check(attempt), due + 1000);
  assert.equal(fixed.dialogueMistakes![card.id].last?.result, 'fixed');
  assert.equal(fixed.dialogueMistakes![card.id].due, due + 1000 + 86_400_000);
  assert.equal(reviewDialogueMistake(fixed, card.id, 'Would you mind picking me up at six?', [], due + 2000), fixed);
});
