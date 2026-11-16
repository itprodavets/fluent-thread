import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectSkillAnswer } from '../src/domain/skill-answer.ts';

test('skill feedback identifies actual snippets and offers a separate softer phrasing', () => {
  const polite = inspectSkillAnswer('Would you mind pick me up? Could you tell me where is it?', 'polite-questions', ['Would you mind']);
  assert.deepEqual(polite.corrections.map(({ before, after }) => [before, after]), [
    ['Would you mind pick', 'Would you mind picking'], ['Could you tell me where is it', 'Could you tell me where it is']
  ]);
  assert.ok(polite.patterns[0].span);
  assert.deepEqual(inspectSkillAnswer('I’m going drive. I’ll to call. I’ll meeting Alex.', 'future-plans', [])
    .corrections.map(issue => issue.after).sort(), ['I’ll call', 'I’ll meet', 'I’m going to drive'].sort());
  const disagree = inspectSkillAnswer('I am agree. I disagree with you. Would it work if we will leave earlier?', 'disagreeing', []);
  assert.deepEqual(disagree.corrections.map(issue => issue.after), ['I agree', 'Would it work if we left']);
  assert.equal(disagree.suggestions[0].after, 'I see your point, but I see it differently.');
  assert.deepEqual(inspectSkillAnswer('I’ll see if we will leave earlier. I see what you mean.', 'disagreeing', []).corrections, []);
});

test('all nine dialogue scenarios have an interlocutor line and model without detected errors', () => {
  const skills = JSON.parse(readFileSync(new URL('../materials/2026-11-16/skills.json', import.meta.url), 'utf8'));
  assert.equal(skills.flatMap(skill => skill.dialogues).length, 9);
  for (const skill of skills) for (const dialogue of skill.dialogues) {
    assert.ok(dialogue.role.line && dialogue.role.patterns.length && dialogue.answer);
    assert.deepEqual(inspectSkillAnswer(dialogue.answer, skill.id, dialogue.role.patterns).corrections, []);
  }
});
