import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyChatPackage, approveTopicMaterials, replaceTopicPackage, restoreMaterialArchive, topicImportPreview } from '../src/domain/chat-package.js';

test('replacement protects edits, archives approved legacy content, and retains IDs on repeat', () => {
  const empty = { language: 'en', topics: [], words: [], resources: [], results: {} };
  const packet = (text: string) => ({ language: 'en', topic: { title: 'Lesson', prompt: '' }, words: [], materials: [{ kind: 'reading', title: 'Dialogue', text }] });
  const first = applyChatPackage(empty, packet('draft'));
  const id = first.topic.id;
  const original = first.next.resources[0];
  assert.equal(topicImportPreview(first.next, id)[0].selected, true);
  const approval = approveTopicMaterials(first.next, id, [original.id]);
  const edited = { ...first.next, resources: [{ ...original, translation: 'personal edit' }] };
  assert.equal(topicImportPreview(edited, id)[0].selected, false);
  assert.equal(replaceTopicPackage(edited, packet('final'), id, approval).archived, 0);
  const unrelated = { ...original, id: 'manual', topicId: id, title: 'My notes' };
  const legacy = { ...first.next, topicPackageMaterials: undefined, resources: [original, unrelated] };
  assert.equal(topicImportPreview(legacy, id)[0].selected, false);
  const result = replaceTopicPackage(legacy, packet('final'), id, approval);
  assert.equal(result.archived, 1);
  assert.deepEqual(result.next.resources.map(r => r.title), ['My notes', 'Dialogue']);
  const repeated = replaceTopicPackage(result.next, packet('final'), id, approveTopicMaterials(result.next, id, [result.next.resources[1].id]));
  assert.deepEqual(repeated.next.resources, result.next.resources);
  assert.deepEqual(restoreMaterialArchive(result.next, result.next.materialArchives[0].id).resources.at(-1), original);
});

test('the format shown for conversation imports is accepted by the importer', async () => {
  const { chatPackageExample, parseChatPackage, buildChatPrompt } = await import('../src/domain/chat-package.js');
  const example = JSON.stringify(chatPackageExample('en', 'A call'), null, 2);
  const parsed = parseChatPackage(example);
  assert.equal(parsed.topic.title, 'A call');
  assert.deepEqual(parsed.materials.map(item => item.kind), ['exercise', 'dialogue']);
  assert.ok(buildChatPrompt('en', 'A call').endsWith(example));
});

test('imported lessons keep each dialogue with its own questions and ignore archived recordings', async () => {
  const { importedLessonsFor } = await import('../src/domain/imported-lessons.ts');
  const { archiveMaterial, parseChatPackage } = await import('../src/domain/chat-package.js');
  const state = { language: 'en', languages: { en: {} }, topics: [], words: [], resources: [], results: {} };
  const packet = (name: string) => parseChatPackage(JSON.stringify({
    format: 'nit-rechi', version: 1, language: 'en', topic: { title: 'Class' },
    materials: [
      { kind: 'dialogue', title: name, text: 'A: Hello.\nB: Hi.', translation: 'Привет.' },
      { kind: 'exercise', title: 'Check ' + name, prompt: 'Question ' + name, answer: 'Answer ' + name }
    ]
  }));
  const first = applyChatPackage(state, packet('First'));
  const next = applyChatPackage(first.next, packet('Second'), first.topic.id).next;
  const repeat = applyChatPackage(next, packet('Second'), first.topic.id).next;
  assert.equal(repeat.importedLessons.length, 2);
  const lessons = importedLessonsFor(repeat);
  assert.equal(lessons[0].resource.translation, 'Привет.');
  assert.deepEqual(lessons.map(lesson => lesson.questions[0][0]), ['Question Second', 'Question First']);
  assert.equal(importedLessonsFor(archiveMaterial(repeat, lessons[0].resource.id)).length, 1);
  assert.equal(importedLessonsFor({ ...first.next, importedLessons: undefined }).length, 1);
});

test('multi-dialogue imports expose every level and pair separate reading exercises with the right version', async () => {
  const { dialogueChoices, importedLessonsFor } = await import('../src/domain/imported-lessons.ts');
  const { parseChatPackage } = await import('../src/domain/chat-package.js');
  const state = { language: 'en', languages: { en: {} }, topics: [], words: [], resources: [], results: {} };
  const context = { format: 'nit-rechi', version: 1, language: 'en', topic: { title: 'Class' } };
  const materials = ['Market · C1', 'Market · B1', 'Market · B2', 'Station · B2', 'Music'].map(title => ({
    kind: 'dialogue', title, text: 'A: Let’s talk about ' + title
  }));
  const first = applyChatPackage(state, parseChatPackage(JSON.stringify({ ...context, materials })));
  const exercises = materials.slice(0, 4).map(item => ({
    kind: 'exercise', title: 'Чтение и ответ · ' + item.title,
    prompt: item.text + '\n\nQuestion for ' + item.title, answer: 'Answer for ' + item.title
  }));
  const next = applyChatPackage(first.next, parseChatPackage(JSON.stringify({ ...context, materials: exercises })), first.topic.id);
  const choices = dialogueChoices(importedLessonsFor(next.next));
  assert.deepEqual(choices.map(choice => [choice.title, choice.versions.map(version => version.level)]), [
    ['Market', ['B1', 'B2', 'C1']], ['Station', ['B2']], ['Music', [undefined]]
  ]);
  assert.deepEqual(choices[0].versions.map(version => version.questions[0][0]), [
    'Question for Market · B1', 'Question for Market · B2', 'Question for Market · C1'
  ]);
  assert.deepEqual(choices[2].versions[0].questions, []);
});
