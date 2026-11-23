import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudy } from '../src/domain/profile-sync.ts';
import { buildLearningGraph } from '../src/domain/learning-graph.ts';
import { learningMapProgress, mapProgressLabel } from '../src/domain/learning-map-progress.ts';
import { assessMaterial } from '../src/domain/material-review.ts';
import { lessonReviewQueue } from '../src/domain/lesson-review.ts';
import type { PracticeResult, Resource, Study } from '../src/domain/model.ts';

const now = 10_000;
const result = (outcome: PracticeResult['result'] = 'independent', due = now + 1000): PracticeResult =>
  ({ result: outcome, level: outcome === 'independent' ? 1 : 0, due, updated: 100, attempts: 1, mode: 'spoken' });
const resource = (id: string, title: string, kind: Resource['kind'] = 'dialogue'): Resource =>
  ({ id, title, kind, topicId: 'lesson', language: 'en', text: 'Partner: Hi\nLearner: Hello', prompt: '', answer: '', url: '' });
function fixture(): Study {
  return { ...emptyStudy(), topics: [{ id: 'lesson', title: 'Lesson', language: 'en', links: [], prompt: '', position: { x: 20, y: 30 }, connections: ['unknown'] }],
    resources: [resource('b1', 'A scene · B1'), resource('b2', 'A scene · B2'), resource('c1', 'A scene · C1'), resource('exercise', 'Exercise', 'exercise')],
    results: { b2: result('independent', now), exercise: result('assisted'), removed: result('independent', 0) } };
}
const view = (study: Study, time = now) => {
  const graph = buildLearningGraph(study, [], []);
  return { graph, progress: learningMapProgress(study, graph, time), scene: graph.nodes.find(n => n.type === 'dialogue')! };
};

test('scene levels stay separate; partial lessons count exact owned materials, not words or deleted evidence', () => {
  const study = fixture(), before = structuredClone(study), { progress, scene } = view(study);
  const lesson = progress.get('lesson')!, sceneProgress = progress.get(scene.id)!;
  assert.equal(lesson.total, 4); assert.equal(lesson.independent, 1); assert.equal(lesson.learning, 1); assert.equal(lesson.due, 1);
  assert.equal(sceneProgress.total, 3); assert.equal(sceneProgress.independent, 1); assert.equal(sceneProgress.new, 2);
  assert.deepEqual(sceneProgress.items.map(i => [i.resource.id, i.status, i.due]), [['b1', 'new', false], ['b2', 'independent', true], ['c1', 'new', false]]);
  assert.match(mapProgressLabel(sceneProgress), /Самостоятельно 1\/3/);
  assert.match(mapProgressLabel(sceneProgress), /Пора повторить 1/);
  assert.deepEqual(study, before);
});

test('latest retry or assisted result replaces mastery; choice-only correctness never establishes productive mastery', () => {
  for (const outcome of ['retry', 'assisted'] as const) {
    const study = fixture(); study.results.b2 = result(outcome);
    assert.equal(view(study).progress.get('lesson')!.independent, 0);
  }
  const study = fixture(); study.results.b2 = { ...result(), mode: 'choice' };
  const item = view(study).progress.get('lesson')!.items.find(i => i.resource.id === 'b2')!;
  assert.equal(item.status, 'learning'); assert.equal(item.due, false);
});

test('repetition uses the existing spoken queue, not the latest written or choice date', () => {
  const study = fixture();
  study.results.b2 = { ...result('independent', now + 9000), mode: 'written', schedules: { written: { level: 1, due: now + 9000, updated: 100 }, spoken: { level: 1, due: now - 10, updated: 50 } } };
  const { progress } = view(study);
  assert.equal(progress.get('lesson')!.due, 1);
  assert.equal(progress.get('lesson')!.items.find(i => i.resource.id === 'b2')!.dueAt, now - 10);
  assert.deepEqual(progress.get('lesson')!.items.filter(i => i.due).map(i => i.resource.id), lessonReviewQueue(study, now).materials.map(i => i.resource.id));
  study.results.b2.schedules!.spoken!.due = now + 5000;
  study.results.b2.due = now - 1;
  assert.equal(view(study).progress.get('lesson')!.due, 0);
});

test('profiles and languages cannot share progress even with identical resource IDs; stale graphs are safe', () => {
  const one = fixture(), two = { ...fixture(), results: {} };
  assert.equal(view(one).progress.get('lesson')!.independent, 1);
  assert.equal(view(two).progress.get('lesson')!.independent, 0);
  const graph = view(one).graph;
  const foreign = { ...one, language: 'fr' };
  assert.equal(learningMapProgress(foreign, graph, now).size, 0);
  one.resources = one.resources.filter(r => r.id !== 'b2');
  assert.equal(learningMapProgress(one, graph, now).get('lesson')!.independent, 0);
  assert.equal(learningMapProgress(one, graph, now).get(graph.nodes.find(n => n.type === 'dialogue')!.id)!.total, 2);
});

test('recompute after grading and due time passes without changing graph edits or unrelated results', () => {
  const study = fixture(), graph = view(study).graph;
  const next = assessMaterial(study, study.resources[0], 'independent', now);
  assert.equal(learningMapProgress(next, graph, now).get('lesson')!.independent, 2);
  assert.equal(next.topics, study.topics); assert.equal(next.languages, study.languages); assert.equal(next.results.b2, study.results.b2);
  const dueAt = next.results.b1.due;
  assert.equal(learningMapProgress(next, graph, dueAt - 1).get('lesson')!.items.find(i => i.resource.id === 'b1')!.due, false);
  assert.equal(learningMapProgress(next, graph, dueAt).get('lesson')!.items.find(i => i.resource.id === 'b1')!.due, true);
});

test('empty lessons remain honest; school and skill nodes do not acquire invented mastery', () => {
  const study = fixture(); study.resources = []; study.topics[0].source = { school: 'School' };
  const { progress, graph } = view(study);
  assert.equal(mapProgressLabel(progress.get('lesson')!), 'Нет материалов');
  assert.equal(progress.has(graph.nodes.find(n => n.type === 'school')!.id), false);
});
