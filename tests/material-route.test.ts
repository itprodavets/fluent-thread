import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materialLessonHref, parseMaterialRoute, resolveMaterialRoute } from '../src/domain/material-route.ts';
import type { Study } from '../src/domain/model';
import type { Skill } from '../src/domain/skill-dialogues';

function fixture(): Study {
  return { language: 'en', languages: { en: {}, zh: {} }, words: [], results: {},
    topics: ['one', 'two'].map(id => ({ id, title: id, language: 'en', links: [], prompt: '', source: { school: id === 'one' ? 'School' : 'Other school' } })),
    resources: ['one', 'two'].flatMap(topicId => ['B1', 'B2', 'C1'].map(level => ({
      id: topicId + ':' + level, topicId, title: 'Shared scene · ' + level, language: 'en', kind: 'dialogue' as const, text: 'A: Hello.\nB: Hi.', prompt: '', answer: '', url: ''
    }))) };
}
const skills: Skill[] = [{ id: 'reply', title: 'Reply', dialogues: [{ school: 'School', title: 'Shared scene', prompt: 'Reply', answer: 'Yes.', role: { line: 'Hello.', patterns: [] }, phrases: [] }] }];
function resolve(study: Study, hash: string) {
  const route = parseMaterialRoute(hash);
  assert.ok(route);
  return resolveMaterialRoute(study, route, skills, []);
}

test('encoded route round trips exact IDs and optional skill while preserving old topic URLs', () => {
  const ids = ['topic /?中文#%', 'resource &+/?', 'skill &=+'];
  assert.deepEqual(parseMaterialRoute(materialLessonHref(...ids as [string, string, string])), {
    topicId: ids[0], resourceId: ids[1], skillId: ids[2]
  });
  assert.equal(materialLessonHref('one'), '#materials/lesson/one');
  assert.deepEqual(parseMaterialRoute('#materials/lesson/one'), { topicId: 'one', resourceId: undefined, skillId: undefined });
  assert.equal(parseMaterialRoute('#materials/skills'), undefined);
  assert.equal(parseMaterialRoute('#materials/reading'), undefined);
});

test('exact B1/B2/C1 resources win over defaults and identically titled scenes in another topic', () => {
  const study = fixture();
  for (const topic of ['one', 'two']) for (const level of ['B1', 'B2', 'C1']) {
    assert.deepEqual(resolve(study, materialLessonHref(topic, topic + ':' + level)), { topicId: topic, resourceId: topic + ':' + level });
  }
  assert.equal(resolve(study, '#materials/lesson/one').resourceId, 'one:B2');
});

test('stale, cross-topic and foreign-language exact IDs fall back inside requested topic with explanation', () => {
  const study = fixture();
  study.resources.push({ ...study.resources[0], id: 'foreign', language: 'zh' });
  for (const id of ['missing', 'two:C1', 'foreign']) {
    const selection = resolve(study, materialLessonHref('one', id));
    assert.equal(selection.topicId, 'one');
    assert.equal(selection.resourceId, 'one:B2');
    assert.ok(selection.notice);
  }
  study.resources = study.resources.filter(item => item.topicId !== 'one');
  const empty = resolve(study, materialLessonHref('one', 'two:C1'));
  assert.equal(empty.topicId, 'one');
  assert.equal(empty.resourceId, undefined);
  assert.ok(empty.notice);
});

test('missing or foreign-language topics never select another lesson', () => {
  const study = fixture();
  study.topics[0].language = 'zh';
  for (const topic of ['one', 'missing']) {
    const selection = resolve(study, materialLessonHref(topic, 'two:C1'));
    assert.equal(selection.topicId, undefined);
    assert.equal(selection.resourceId, undefined);
    assert.ok(selection.notice);
  }
});

test('malformed escapes never throw or lose a valid requested topic boundary', () => {
  const study = fixture();
  const brokenQuery = resolve(study, '#materials/lesson/one?resource=%E0%A4%A');
  assert.equal(brokenQuery.topicId, 'one');
  assert.equal(brokenQuery.resourceId, 'one:B2');
  assert.ok(brokenQuery.notice);
  const brokenPath = resolve(study, '#materials/lesson/%E0%A4%A?resource=two%3AC1');
  assert.equal(brokenPath.topicId, undefined);
  assert.ok(brokenPath.notice);
});

test('skill context needs an exact, unique current-language school/scene match', () => {
  const study = fixture();
  assert.equal(resolve(study, materialLessonHref('one', 'one:C1', 'reply')).skillId, 'reply');
  for (const [topic, resource, skill] of [['two', 'two:C1', 'reply'], ['one', 'one:C1', 'unknown'], ['one', 'missing', 'reply'], ['one', '', 'reply']]) {
    const selection = resolve(study, materialLessonHref(topic, resource, skill));
    assert.equal(selection.skillId, undefined);
    assert.ok(selection.notice);
  }
  study.topics[1].source = { school: 'School' };
  assert.equal(resolve(study, materialLessonHref('one', 'one:C1', 'reply')).skillId, undefined);
  study.language = 'zh';
  study.topics[0].language = 'zh';
  study.resources[0].language = 'zh';
  assert.equal(resolve(study, materialLessonHref('one', 'one:B1', 'reply')).skillId, undefined);
});

test('route resolution preserves all learning results and review state', () => {
  const study = fixture();
  study.results['one:C1'] = { level: 3, result: 'independent', due: 42, attempts: 2, updated: 12,
    schedules: { spoken: { level: 3, due: 42, updated: 12 } } };
  const before = structuredClone(study);
  resolve(study, materialLessonHref('one', 'one:C1', 'reply'));
  resolve(study, materialLessonHref('one', 'missing'));
  assert.deepEqual(study, before);
});


test('all six optional levels and legacy starter routes retain their exact version', () => {
  const study = fixture();
  for (const level of ['A1', 'A2', 'C2']) study.resources.push({ ...study.resources[0], id: 'one:' + level, title: 'Shared scene · ' + level });
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    assert.equal(resolve(study, materialLessonHref('one', 'one:' + level)).resourceId, 'one:' + level);
    assert.equal(resolve(study, materialLessonHref('introduction', 'starter:en:introduction:' + level)).resourceId, 'starter:en:introduction:' + level);
  }
  assert.equal(resolve(study, '#materials/lesson/introduction').topicId, 'introduction');
});
