import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudy } from '../src/domain/profile-sync.ts';
import { buildLearningGraph } from '../src/domain/learning-graph.ts';
import { learningMapProgress } from '../src/domain/learning-map-progress.ts';
import { matchesMapProgress, mapPracticeTarget, mapResultsPage } from '../src/domain/learning-map-filter.ts';
import { parseMaterialRoute, resolveMaterialRoute } from '../src/domain/material-route.ts';
import type { Study } from '../src/domain/model.ts';
function setup() {
  const study: Study = { ...emptyStudy(), topics: [{ id: 't', title: 'Lesson', language: 'en', links: [], prompt: '', source: { school: 'School' } }],
    resources: ['B1','B2','C1'].map(level => ({ id: level, topicId: 't', language: 'en', kind: 'dialogue', title: 'Scene · ' + level, text: 'A: Hello', prompt: '', answer: '', url: '' })),
    results: { B2: { level: 0, result: 'assisted', mode: 'spoken', attempts: 1, due: 9000, updated: 10 }, C1: { level: 1, result: 'independent', mode: 'spoken', attempts: 1, due: 100, updated: 10 } } };
  const graph = buildLearningGraph(study, [], []), progress = learningMapProgress(study, graph, 1000);
  return { study, graph, progress, scene: graph.nodes.find(n => n.type === 'dialogue')! };
}
test('filters overlap by actual material status and exclude school context, without mutating evidence', () => {
  const { study, graph, progress, scene } = setup(), before = structuredClone(study);
  for (const filter of ['due','new','learning'] as const) {
    assert.equal(matchesMapProgress(progress.get(scene.id), filter), true);
    assert.equal(matchesMapProgress(progress.get(graph.nodes.find(n => n.type === 'school')!.id), filter), false);
  }
  assert.equal(matchesMapProgress(undefined, 'all'), true);
  assert.deepEqual(study, before);
});
test('each filter opens the matching exact version rather than default B2', () => {
  const { study, graph, progress, scene } = setup();
  for (const [filter, expected] of [['due','C1'],['learning','B2'],['new','B1']] as const) {
    const target = mapPracticeTarget(scene, progress.get(scene.id), filter, graph)!;
    assert.equal(target.item.resource.id, expected);
    assert.equal(resolveMaterialRoute(study, parseMaterialRoute(target.href!)!, [], []).resourceId, expected);
  }
});
test('empty or second-profile results cannot offer another profile repetition; resource changes recalculate', () => {
  const { study, graph, scene } = setup();
  study.results = {};
  const progress = learningMapProgress(study, graph, 1000);
  assert.equal(mapPracticeTarget(scene, progress.get(scene.id), 'due', graph), undefined);
  assert.equal(matchesMapProgress(progress.get(scene.id), 'learning'), false);
  assert.equal(matchesMapProgress(progress.get(scene.id), 'new'), true);
});
test('bounded page clamps when status results shrink after sync or grading', () => {
  assert.deepEqual(mapResultsPage([1,2,3], 9), { items: [1,2,3], page: 0, pages: 1 });
  assert.deepEqual(mapResultsPage([], 9), { items: [], page: 0, pages: 1 });
  assert.equal(mapResultsPage(Array.from({ length: 25 }, (_, i) => i), 1).items[0], 12);
});
