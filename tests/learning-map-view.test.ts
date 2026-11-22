import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectLearningGraph } from '../src/domain/learning-graph.ts';
import type { LearningGraph } from '../src/domain/learning-graph.ts';
import { materialLessonHref } from '../src/domain/material-route.ts';
import { learningFocusPage, learningMapFrame, learningMapPositions, learningNodeLabels } from '../src/components/learning-map-view.ts';

test('presentation fit round trips global positions in widely separated and narrow focus', () => {
  for (const points of [[{ x: 21, y: 93 }, { x: 79, y: 7 }], [{ x: 55, y: 60 }], [{ x: -10, y: 400 }, { x: 200, y: 500 }]]) {
    const original = structuredClone(points);
    const frame = learningMapFrame(points);
    for (const point of points) {
      const result = frame.world(frame.present(point));
      assert.ok(Math.abs(result.x - point.x) < 0.00001);
      assert.ok(Math.abs(result.y - point.y) < 0.00001);
    }
    assert.deepEqual(points, original);
  }
});

test('pointer displacement converts through fitted and zoomed canvas without saving presentation coordinates', () => {
  const frame = learningMapFrame([{ x: 20, y: 10 }, { x: 80, y: 90 }]);
  const origin = { x: 30, y: 40 };
  const shown = frame.present(origin);
  // A 140px movement on a 1400px zoomed canvas is ten presentation units.
  const moved = frame.world({ x: shown.x + 140 / 1400 * 100, y: shown.y });
  assert.ok(Math.abs(moved.x - origin.x - 60 / 7) < 0.00001);
  assert.equal(moved.y, origin.y);
  assert.deepEqual(Object.keys(learningNodeLabels).sort(), ['dialogue', 'lesson', 'school', 'skill']);
});

test('coincident generated nodes remain individually reachable without changing saved points', () => {
  const nodes = Array.from({ length: 12 }, (_, id) => ({ id: String(id), point: { x: 50, y: 50 } }));
  const before = structuredClone(nodes);
  const positions = [...learningMapPositions(nodes, 1200).values()];
  assert.equal(positions.length, 12);
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    assert.ok(Math.abs(positions[i].x - positions[j].x) >= 28 || Math.abs(positions[i].y - positions[j].y) >= 112 / 1200 * 100);
  }
  assert.deepEqual(nodes, before);
});

test('focus paging resets for a different selection', () => {
  const selection = { focusId: 'skill:conversation', page: 1 };
  assert.equal(learningFocusPage(selection, 'skill:conversation'), 1);
  assert.equal(learningFocusPage(selection, 'school:new'), 0);
  assert.equal(learningFocusPage(selection, 'skill:other-language'), 0);
  assert.equal(learningFocusPage({ focusId: selection.focusId, page: 0 }, selection.focusId), 0);
});

test('second skill page supplies exact practice targets from its visible scenes', () => {
  const scenes = Array.from({ length: 13 }, (_, index) => ({ id: 'scene:' + index, type: 'dialogue' as const, title: 'Scene ' + index, language: 'en', point: { x: 20, y: 30 }, topicId: 'lesson', versions: [{ id: 'resource:' + index, level: 'C1' as const }] }));
  const graph: LearningGraph = {
    nodes: [{ id: 'skill', type: 'skill', skillId: 'conversation', title: 'Conversation', language: 'en', point: { x: 50, y: 50 } }, ...scenes],
    edges: scenes.map(scene => ({ id: scene.id, from: 'skill', to: scene.id, automatic: true, manual: false })), height: 500
  };
  const page = learningFocusPage({ focusId: 'skill', page: 1 }, 'skill');
  // Map passes this same projection to the canvas and uses it for detail actions.
  const view = projectLearningGraph(graph, 'skill', page);
  const detailScenes = view.nodes.filter(node => node.type === 'dialogue');
  assert.deepEqual(detailScenes.map(node => node.id), ['scene:12']);
  assert.equal(materialLessonHref(detailScenes[0].topicId!, detailScenes[0].versions![0].id, 'conversation'), '#materials/lesson/lesson?resource=resource%3A12&skill=conversation');
});
