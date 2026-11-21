import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyChatPackage, parseChatPackage } from '../src/domain/chat-package.js';
import { emptyStudy } from '../src/domain/profile-sync.ts';
import { dialogueChoices, importedLessonsFor } from '../src/domain/imported-lessons.ts';
import { teacherPhraseCards } from '../src/domain/lesson-practice.ts';
import { assessMaterial, materialRetryDelay } from '../src/domain/material-review.ts';
import { lessonReviewQueue } from '../src/domain/lesson-review.ts';
const folder = new URL('../materials/en/lessons/ace-tefl/', import.meta.url);
const parse = (file: string) => parseChatPackage(readFileSync(new URL(file, folder), 'utf8'));

test('report writing adds a complete six-level practice unit without changing the source lesson or its progress', () => {
  const original = applyChatPackage(emptyStudy(), parse('reports-and-mirror-town/lesson.json'));
  const oldResource = original.next.resources[0];
  const prior = assessMaterial(original.next, oldResource, 'independent', 1800000000000);
  const packet = parse('report-opening-sentences/lesson.json');
  const addition = applyChatPackage(prior, packet);
  assert.equal(addition.next.results, prior.results);
  assert.equal(addition.next.resources.find(item => item.id === oldResource.id), oldResource);
  const choice = dialogueChoices(importedLessonsFor(addition.next).filter(item => item.topicId === addition.topic.id));
  assert.equal(choice.length, 1);
  assert.deepEqual(choice[0].versions.map(item => item.level), ['A1','A2','B1','B2','C1','C2']);
  for (const version of choice[0].versions) {
    assert.ok(version.resource.translation);
    assert.equal(version.questions.length, 1);
    assert.match(version.questions[0][0], /четыре предложения/);
  }
  const cards = teacherPhraseCards(packet.materials.find(item => item.title.startsWith('Полезные фразы ·'))!.text);
  assert.equal(cards.length,14);
  assert.ok(cards.every(card => card.meaning && card.pattern && card.example));
  for (const heading of ['Why the report has been written', 'Benefits of the proposed scheme', 'Drawbacks of the proposed scheme', 'Recommendations']) {
    assert.ok(packet.materials.filter(item => item.kind === 'reading' && / · (A1|A2|B1|B2|C1|C2)$/.test(item.title)).every(item => item.text.includes(heading)));
  }
  const exercises=packet.materials.filter(item=>item.title.startsWith('Грамматика ·'));
  assert.equal(exercises.length,10);
  assert.ok(exercises.every(item=>item.prompt && item.answer));
  const saved = addition.next;
  const repeated = applyChatPackage(saved,packet);
  assert.equal(repeated.wordsAdded,0); assert.equal(repeated.materialsAdded,0);
  const exercise=saved.resources.find(item=>item.topicId===addition.topic.id && item.title.includes('9 · Перенеси'))!;
  const now=1800000000000;
  const retry=assessMaterial(saved,exercise,'retry',now);
  assert.ok(!lessonReviewQueue(retry,now).materials.some(item=>item.resource.id===exercise.id));
  assert.ok(lessonReviewQueue(retry,now+materialRetryDelay).materials.some(item=>item.resource.id===exercise.id));
  assert.deepEqual(retry.results[oldResource.id], prior.results[oldResource.id]);
});
