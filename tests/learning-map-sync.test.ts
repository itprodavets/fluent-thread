import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudy, packStudy, unpackStudy, reconcileRow, pendingChanges, mergeValue, resolveConflict } from '../src/domain/profile-sync.ts';
import type { ProfileDocument } from '../src/domain/profile-sync.ts';
const key = JSON.stringify(['languages', 'en']);
const entry = (x: number) => ({ kind: 'position', nodeId: 'node', point: { x, y: 20 } });
function document(local: object, base: object | null = {}): ProfileDocument {
  return { study: { ...emptyStudy(), languages: { en: local } }, base: base === null ? {} : { [key]: { value: base, revision: 1 } }, cursor: 0, conflicts: [] };
}
const reconcile = (doc: ProfileDocument, remote: object) => reconcileRow(doc, { id: key, value: remote, revision: 2 });
test('known language records round trip nested overlays, null tombstones and unknown metadata', () => {
  const study = { ...emptyStudy(), languages: { en: { custom: { future: true }, learningMap: { a: entry(20), removed: null } }, fr: { learningMap: { a: entry(30) } } } };
  const records = packStudy(study);
  assert.ok(Object.keys(records).every(id => !JSON.parse(id).includes('learningMap')));
  assert.deepEqual(unpackStudy(records), study);
});
test('initial independent overlay edits merge with absent overlay and absent language row', () => {
  for (const base of [{}, null]) {
    const doc = document({ learningMap: { a: entry(20) } }, base);
    const next = reconcile(doc, { learningMap: { b: entry(30) } });
    assert.deepEqual((next.study.languages.en as any).learningMap, { a: entry(20), b: entry(30) });
    assert.equal(next.conflicts.length, 0);
    assert.equal(pendingChanges(next).find(c => c.id === key)?.expected, 2);
  }
});
test('distinct edits combine but conflicting same entry retains alternatives', () => {
  const base = { learningMap: { a: entry(20), b: entry(20) } };
  const next = reconcile(document({ learningMap: { a: entry(30), b: entry(20) } }, base), { learningMap: { a: entry(20), b: entry(40) } });
  assert.deepEqual((next.study.languages.en as any).learningMap, { a: entry(30), b: entry(40) });
  assert.equal(next.conflicts.length, 0);
  const conflict = reconcile(document({ learningMap: { a: entry(30) } }, { learningMap: { a: entry(20) } }), { learningMap: { a: entry(40) } });
  assert.equal(conflict.conflicts.length, 1);
  assert.deepEqual((conflict.study.languages.en as any).learningMap.a, entry(40));
  assert.deepEqual(conflict.conflicts[0].local, entry(30));
  assert.equal(conflict.conflicts[0].entryKey, 'a');
});
test('explicit entry tombstones survive delete versus edit in both directions and subsequent round trips', () => {
  const base = { learningMap: { a: entry(20) } };
  for (const [local, remote] of [[null, entry(30)], [entry(30), null]]) {
    const next = reconcile(document({ learningMap: { a: local } }, base), { learningMap: { a: remote } });
    assert.equal((next.study.languages.en as any).learningMap.a, null);
    assert.equal(next.conflicts.length, 1);
    assert.equal((unpackStudy(packStudy(next.study)).languages.en as any).learningMap.a, null);
  }
});
test('ordinary metadata and generic merging retain original semantics and other languages are untouched', () => {
  const local = { custom: { a: 1 }, learningMap: { a: entry(20) } }, remote = { custom: { b: 2 }, learningMap: { b: entry(30) } };
  const doc = document(local); doc.study.languages.fr = { learningMap: { a: entry(50) } };
  const next = reconcile(doc, remote);
  assert.deepEqual((next.study.languages.en as any).custom, mergeValue(undefined, local.custom, remote.custom).value);
  assert.equal(next.conflicts.length, 1);
  assert.deepEqual(next.study.languages.fr, doc.study.languages.fr);
  assert.deepEqual(mergeValue({}, { learningMap: { a: 1 } }, { learningMap: { b: 2 } }), { value: { learningMap: { b: 2 } }, conflict: true });
});

test('entry conflict choices preserve independent remote and subsequent local edits', () => {
  for (const keepLocal of [true, false]) {
    const base = { setting: 'before', learningMap: { a: entry(10) } };
    let next = reconcile(document({ ...base, learningMap: { a: entry(20) } }, base), { ...base, learningMap: { a: entry(30), b: entry(40) } });
    next.study.languages.en = { ...(next.study.languages.en as any), setting: 'after', learningMap: { ...(next.study.languages.en as any).learningMap, c: entry(50) } };
    next = resolveConflict(next, next.conflicts[0].id, keepLocal);
    assert.deepEqual(next.study.languages.en, { setting: 'after', learningMap: { a: entry(keepLocal ? 20 : 30), b: entry(40), c: entry(50) } });
    assert.equal(next.conflicts.length, 0);
  }
});
test('delete versus edit can explicitly resolve either alternative without touching other entries', () => {
  for (const [local, remote] of [[null, entry(30)], [entry(30), null]]) for (const keepLocal of [true, false]) {
    let next = reconcile(document({ learningMap: { a: local } }, { learningMap: { a: entry(10) } }), { learningMap: { a: remote, b: entry(40) } });
    next = resolveConflict(next, next.conflicts[0].id, keepLocal);
    assert.deepEqual((next.study.languages.en as any).learningMap, { a: keepLocal ? local : remote, b: entry(40) });
  }
});
test('language metadata conflict resolution preserves concurrent graph entries', () => {
  for (const keepLocal of [true, false]) {
    const next = reconcile(document({ setting: 'mine', learningMap: { a: entry(20) } }, { setting: 'old' }), { setting: 'theirs', learningMap: { b: entry(30) } });
    const resolved = resolveConflict(next, next.conflicts[0].id, keepLocal);
    assert.deepEqual(resolved.study.languages.en, { setting: keepLocal ? 'mine' : 'theirs', learningMap: { a: entry(20), b: entry(30) } });
  }
});

test('metadata conflict choices patch only conflicted paths and retain merged and subsequent sibling edits', () => {
  for (const keepLocal of [true, false]) {
    const base = { setting: 'old', note: 'original', nested: { setting: 'old', note: 'original' }, learningMap: {} };
    const local = { ...base, setting: 'mine', note: 'independent', nested: { setting: 'mine', note: 'independent' } };
    const remote = { ...base, setting: 'remote', nested: { setting: 'remote', note: 'original' } };
    let next = reconcile(document(local, base), remote);
    assert.equal((next.study.languages.en as any).note, 'independent');
    assert.equal(next.conflicts.length, 2);
    next.study.languages.en = { ...(next.study.languages.en as any), later: 'kept', nested: { ...(next.study.languages.en as any).nested, later: 'kept' } };
    for (const conflict of [...next.conflicts]) next = resolveConflict(next, conflict.id, keepLocal);
    assert.deepEqual(next.study.languages.en, { setting: keepLocal ? 'mine' : 'remote', note: 'independent', later: 'kept',
      nested: { setting: keepLocal ? 'mine' : 'remote', note: 'independent', later: 'kept' }, learningMap: {} });
  }
});
