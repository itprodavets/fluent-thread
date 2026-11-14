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
