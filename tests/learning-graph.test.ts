import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudy } from '../src/domain/profile-sync.ts';
import { buildLearningGraph, projectLearningGraph, moveLearningNode, connectLearningNodes, disconnectLearningNodes, learningEdgeId } from '../src/domain/learning-graph.ts';
import type { Study, Topic, Resource } from '../src/domain/model.ts';
import type { Skill } from '../src/domain/skill-dialogues.ts';
const topic = (id: string, school?: string): Topic => ({ id, title: id, language: 'en', links: [], prompt: '', ...(school ? { source: { school } } : {}) });
const resource = (id: string, topicId: string, title: string): Resource => ({ id, topicId, title, language: 'en', kind: 'dialogue', text: 'A: hello', prompt: '', answer: '', url: '' });
const skill = (school: string, title: string): Skill => ({ id: 'skill', title: 'Skill', dialogues: [{ school, title, prompt: '', answer: '', role: { line: '', patterns: [] }, phrases: [] }] });
function fixture(): Study { return { ...emptyStudy(), topics: [topic('a', 'School'), topic('b', 'Other'), topic('ordinary')], resources: [resource('a1', 'a', 'Scene · B1'), resource('a2', 'a', 'Scene · C1'), resource('b1', 'b', 'Scene · B1'), resource('raw', 'a', 'Free')], results: { a1: { result: 'independent', attempts: 4, level: 2, updated: 100, due: 999, schedules: { spoken: { level: 2, due: 999 } } } } }; }
const build = (study: Study, skills: Skill[] = []) => buildLearningGraph(study, [], skills);

test('source school, per-topic scenes, versions and ordinary topics are derived without progress changes', () => {
  const study = fixture(), before = structuredClone(study), graph = build(study, [skill('School', 'Scene')]);
  assert.deepEqual(study, before);
  assert.equal(graph.nodes.filter(n => n.type === 'lesson').length, 3);
  assert.equal(graph.nodes.filter(n => n.type === 'school').length, 2);
  const scenes = graph.nodes.filter(n => n.type === 'dialogue');
  assert.equal(scenes.length, 3);
  assert.deepEqual(scenes.find(n => n.topicId === 'a' && n.title === 'Scene')!.versions, [{ id: 'a1', level: 'B1' }, { id: 'a2', level: 'C1' }]);
  assert.equal(graph.edges.filter(e => e.label === 'Навык → сцена').length, 1);
  assert.notEqual(scenes.find(n => n.topicId === 'a')!.id, scenes.find(n => n.topicId === 'b')!.id);
});
test('duplicate level versions discriminate identity and ambiguous catalog matches remain unlinked', () => {
  const study = fixture(); study.resources.push(resource('duplicate', 'a', 'Scene · B1'));
  const graph = build(study, [skill('School', 'Scene')]);
  assert.equal(graph.nodes.filter(n => n.type === 'dialogue' && n.topicId === 'a').length, 3);
  assert.equal(graph.edges.filter(e => e.label === 'Навык → сцена').length, 0);
  const sameSchool = fixture(); sameSchool.topics[1].source = { school: 'School' };
  assert.equal(build(sameSchool, [skill('School', 'Scene')]).edges.filter(e => e.label === 'Навык → сцена').length, 0);
});
test('untagged scenes have no guessed skills; dated English source and language isolation', () => {
  const study = fixture(); study.topics[0].source = undefined;
  assert.equal(buildLearningGraph(study, [{ topic: 'a', school: 'Catalog' }], [skill('Catalog', 'Scene')]).edges.filter(e => e.label === 'Навык → сцена').length, 1);
  assert.equal(build(study, [skill('School', 'Scene')]).edges.filter(e => e.label === 'Навык → сцена').length, 0);
  const foreign = { ...study, language: 'fr', topics: [ ...study.topics, { ...topic('fr'), language: 'fr' } ] };
  const graph = build(foreign, [skill('School', 'Scene')]);
  assert.deepEqual(graph.nodes.map(n => n.id), ['fr']);
});
test('legacy position/connections remain authoritative; typed moves and links preserve all learning records', () => {
  let study = fixture(); study.topics[0].position = { x: 35, y: 44 }; study.topics[0].connections = ['b', 'missing'];
  let graph = build(study); assert.deepEqual(graph.nodes.find(n => n.id === 'a')!.point, { x: 35, y: 44 });
  assert.equal(graph.edges.find(e => e.id === learningEdgeId('a', 'b'))?.manual, true);
  const scene = graph.nodes.find(n => n.type === 'dialogue')!;
  const before = study;
  study = moveLearningNode(study, graph, scene.id, { x: 60, y: 50 });
  assert.equal(study.results, before.results); assert.equal(study.resources, before.resources); assert.equal(study.words, before.words); assert.equal(study.topics, before.topics);
  study = moveLearningNode(study, graph, 'a', { x: 40, y: 45 });
  assert.deepEqual(study.topics[0].position, { x: 40, y: 45 });
  study = connectLearningNodes(study, build(study), 'ordinary', scene.id);
  graph = build(study); const edge = graph.edges.find(e => e.id === learningEdgeId('ordinary', scene.id))!;
  assert.equal(edge.manual, true); assert.equal(edge.automatic, false);
  study = disconnectLearningNodes(study, graph, edge.id);
  assert.equal(build(study).edges.some(e => e.id === edge.id), false);
  assert.equal((study.languages.en as any).learningMap[edge.id], null);
});
test('reject invalid/duplicate/automatic connections; remove manual layer only when automatic content arrives', () => {
  const study = fixture(), graph = build(study), scene = graph.nodes.find(n => n.type === 'dialogue')!;
  for (const [a, b] of [['a','a'], ['a','missing'], ['a',scene.id]]) assert.equal(connectLearningNodes(study, graph, a, b), study);
  assert.equal(disconnectLearningNodes(study, graph, graph.edges.find(e => e.automatic)!.id), study);
  const school = graph.nodes.find(n => n.type === 'school')!;
  let linked = connectLearningNodes(study, graph, school.id, 'ordinary');
  linked = { ...linked, topics: linked.topics.map(t => t.id === 'ordinary' ? { ...t, source: { school: school.title } } : t) };
  const refreshed = build(linked), edge = refreshed.edges.find(e => e.id === learningEdgeId(school.id, 'ordinary'))!;
  assert.equal(edge.automatic, true); assert.equal(edge.manual, true);
  const removed = build(disconnectLearningNodes(linked, refreshed, edge.id)).edges.find(e => e.id === edge.id)!;
  assert.equal(removed.automatic, true); assert.equal(removed.manual, false);
});
test('stale references, bad overlay entries and bad positions remain saved without rendering or mutation', () => {
  const study = fixture(); study.topics[0].position = { x: NaN, y: Infinity };
  study.languages.en = { learningMap: { stale: { kind: 'edge', from: 'unknown', to: 'a' }, bad: { kind: 'position' }, gone: null } };
  const graph = build(study);
  assert.ok(graph.nodes.every(n => Number.isFinite(n.point.x) && Number.isFinite(n.point.y)));
  assert.equal(graph.edges.some(e => e.from === 'unknown'), false);
  assert.equal((study.languages.en as any).learningMap.gone, null);
});
test('school and skill projection are bounded, include context, preserve global positions and are read only', () => {
  const study = fixture();
  study.topics = Array.from({ length: 30 }, (_, i) => topic('topic' + i, 'School'));
  study.resources = study.topics.map((t, i) => resource('r' + i, t.id, 'Scene' + i + ' · B1'));
  const graph = build(study, [{ id: 's', title: 'All', dialogues: study.topics.map((_,i) => ({ ...skill('School', 'Scene' + i).dialogues[0] })) }]);
  const before = structuredClone(graph);
  for (const type of ['school', 'skill']) {
    const id = graph.nodes.find(n => n.type === type)!.id;
    const first = projectLearningGraph(graph, id), second = projectLearningGraph(graph, id, 1);
    assert.equal(first.total, 30); assert.equal(first.pages, 3);
    assert.equal(first.nodes.filter(n => n.type === (type === 'school' ? 'lesson' : 'dialogue')).length, 12);
    assert.equal(second.nodes.filter(n => n.type === (type === 'school' ? 'lesson' : 'dialogue')).length, 12);
    assert.ok(first.nodes.every(n => n.point === graph.nodes.find(g => g.id === n.id)!.point));
  }
  assert.deepEqual(graph, before);
});

test('manual school-to-school and skill-to-skill links remain visible from either focus', () => {
  let study = fixture();
  const skills = [skill('School', 'Scene'), { ...skill('Other', 'Scene'), id: 'second' }];
  for (const type of ['school', 'skill']) {
    let graph = build(study, skills);
    const [a, b] = graph.nodes.filter(node => node.type === type);
    study = connectLearningNodes(study, graph, a.id, b.id); graph = build(study, skills);
    for (const focus of [a.id, b.id]) {
      const visible = projectLearningGraph(graph, focus);
      assert.ok(visible.edges.some(edge => edge.id === learningEdgeId(a.id, b.id) && edge.manual));
      assert.ok(visible.nodes.some(node => node.id === a.id));
      assert.ok(visible.nodes.some(node => node.id === b.id));
    }
  }
});
