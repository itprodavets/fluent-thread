import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dialogueLines, roleTurns } from '../src/domain/role-play.ts';

test('speaks partner lines in order and reserves learner lines for feedback', () => {
  const lines = dialogueLines('Teacher: Good morning.\nTeacher: Where do you live?\nStudent: I live in China.\nIn Guangzhou.\nStudent: How about you?\nTeacher: In London.\nTeacher: See you next week!');
  const { responses, closing } = roleTurns(lines, 'Student');
  assert.deepEqual(responses.map(turn => turn.partner.map(line => line.text)), [['Good morning.', 'Where do you live?']]);
  assert.equal(responses[0].model, 'I live in China. In Guangzhou.\nHow about you?');
  assert.deepEqual(closing.map(line => line.text), ['In London.', 'See you next week!']);
  assert.equal(roleTurns(lines, 'Teacher').responses[0].partner.length, 0);
  assert.deepEqual(dialogueLines('A paragraph with no named speakers.'), []);
});
