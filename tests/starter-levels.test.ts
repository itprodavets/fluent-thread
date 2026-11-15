import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStarterResource, levels, starterLessons, starterScenes } from '../src/domain/starter-materials.ts';

test('every situation has six independently selectable dialogue and listening lessons', () => {
  for (const scene of starterScenes) {
    const versions = starterLessons.filter(lesson => lesson.sceneId === scene.id);
    assert.deepEqual(versions.map(lesson => lesson.level), levels);
    assert.equal(new Set(versions.map(lesson => lesson.resource.id)).size, levels.length);
    for (const lesson of versions) {
      assert.ok(isStarterResource(lesson.resource.id));
      assert.equal(lesson.resource.kind, 'dialogue');
      assert.ok(lesson.resource.text.includes('Denis:'));
      assert.ok(lesson.questions.length >= 3);
    }
  }
  assert.ok(isStarterResource('starter:en:A1'));
  assert.ok(!isStarterResource('personal:A1'));
});
