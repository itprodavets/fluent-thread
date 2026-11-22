import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learningMapFrame, learningMapPositions, learningNodeLabels } from '../src/components/learning-map-view.ts';

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
