import type { Study } from './model.ts';

export type Value = any;
export type CloudRow = { id: string; value: Value; revision: number };
export type Change = { id: string; value: Value; expected: number };
export type Conflict = { id: string; key: string; local: Value; remote: Value; at: number };
export type ProfileDocument = { study: Study; base: Record<string, { value: Value; revision: number }>; cursor: number; conflicts: Conflict[] };
const arrays = new Set(['words', 'topics', 'resources', 'conversationRoutes', 'importedLessons', 'materialArchives']);
const maps = new Set(['languages', 'results', 'topicPackageMaterials', 'ankiImports', 'dialogueMistakes', 'dailySpeech', 'learningSessions', 'dialogueSessions', 'storySessions', 'practiceDays']);
const own = (object: object, key: string) => Object.hasOwn(object, key);
const forbidden = (key: string) => ['__proto__', 'constructor', 'prototype'].includes(key);
export function emptyStudy(): Study {
  return { language: 'en', languages: { en: {} }, words: [], topics: [], resources: [], results: {} };
}
export function equal(a: Value, b: Value) { return JSON.stringify(a) === JSON.stringify(b); }
export function packStudy(study: Study): Record<string, Value> {
  const entries: [string, Value][] = [];
  for (const [field, value] of Object.entries(study)) {
    if (value === undefined) continue;
    if (arrays.has(field)) {
      entries.push([JSON.stringify(['order', field]), value.length <= 1000 ? value.map((item: {id:string}) => item.id) : []]);
      for (const item of value) entries.push([JSON.stringify([field, item.id]), item]);
    } else if (maps.has(field)) {
      entries.push([JSON.stringify(['map', field]), true]);
      for (const [key, item] of Object.entries(value)) entries.push([JSON.stringify([field, key]), item]);
    } else entries.push([JSON.stringify(['field', field]), value]);
  }
  return Object.fromEntries(entries);
}
export function unpackStudy(records: Record<string, Value>): Study {
  const study: Record<string, Value> = {};
  const orders = new Map<string, string[]>();
  const entries = Object.entries(records).filter(([, value]) => value !== null && value !== undefined);
  for (const [id, value] of entries) {
    const [group, key] = JSON.parse(id);
    if (forbidden(group) || forbidden(key)) continue;
    if (group === 'field') study[key] = value;
    if (group === 'order' && arrays.has(key)) { study[key] = []; orders.set(key, value); }
    if (group === 'map' && maps.has(key)) study[key] = {};
  }
  for (const [id, value] of entries) {
    const [group, key] = JSON.parse(id);
    if (forbidden(group) || forbidden(key)) continue;
    if (arrays.has(group)) (study[group] ??= []).push(value);
    if (maps.has(group)) (study[group] ??= {})[key] = value;
  }
  for (const [group, order] of orders) {
    const positions = new Map(order.map((id, index) => [id, index]));
    study[group].sort((a:{id:string},b:{id:string}) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
  }
  return { ...emptyStudy(), ...study } as Study;
}
// Three-way merge. A remote tombstone wins over a concurrent edit, but the edit is retained as a conflict.
export function mergeValue(base: Value, local: Value, remote: Value, counters = false): { value: Value; conflict: boolean } {
  if (equal(local, base)) return { value: remote, conflict: false };
  if (equal(remote, base)) return { value: local, conflict: false };
  if (counters && [base, local, remote].every(value => typeof value === 'number'))
    return { value: Math.max(0, local + remote - base), conflict: false };
  if (!counters && equal(local, remote)) return { value: local, conflict: false };
  if (counters && base == null && local !== null && remote !== null) {
    if (typeof local === 'number' && typeof remote === 'number') return { value: local + remote, conflict: false };
    if (typeof local === 'object' && typeof remote === 'object') base = {};
  }
  const objects = [base, local, remote].every(value => value && typeof value === 'object' && !Array.isArray(value));
  if (objects) {
    const value: Record<string, Value> = {}; let conflict = false;
    for (const key of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)])) {
      if (forbidden(key)) continue;
      const merged = mergeValue(base[key], local[key], remote[key], counters);
      if (merged.value !== undefined) value[key] = merged.value;
      conflict ||= merged.conflict;
    }
    return { value, conflict };
  }
  return { value: remote, conflict: true };
}
export function pendingChanges(document: ProfileDocument): Change[] {
  const records = packStudy(document.study);
  return [...new Set([...Object.keys(records), ...Object.keys(document.base)])].flatMap(id => {
    const value = records[id] ?? null, before = document.base[id];
    return equal(value, before?.value ?? null) ? [] : [{ id, value, expected: before?.revision ?? 0 }];
  });
}
export function reconcileRows(document: ProfileDocument, rows: CloudRow[], sent?: Map<string, Value>): ProfileDocument {
  const records = packStudy(document.study);
  const base = { ...document.base }, conflicts = [...document.conflicts];
  let changed = false;
  for (const row of rows) {
    const before = base[row.id];
    if (before && row.revision <= before.revision) continue;
    const local = own(records, row.id) ? records[row.id] : null;
    const previous = sent?.has(row.id) ? sent.get(row.id) : before?.value ?? null;
    const group = JSON.parse(row.id)[0];
    const merged = group === 'order' && Array.isArray(local) && Array.isArray(row.value)
      ? { value: [...new Set([...row.value, ...local])], conflict: false }
      : mergeValue(previous, local, row.value, group === 'practiceDays');
    records[row.id] = merged.value;
    base[row.id] = { value: row.value, revision: row.revision };
    if (merged.conflict) conflicts.push({ id: crypto.randomUUID(), key: row.id, local, remote: row.value, at: Date.now() });
    changed = true;
  }
  return changed ? { ...document, study: unpackStudy(records), base, conflicts } : document;
}
export function reconcileRow(document: ProfileDocument, row: CloudRow, sent?: Value): ProfileDocument {
  return reconcileRows(document, [row], arguments.length >= 3 ? new Map([[row.id, sent]]) : undefined);
}
export function resolveConflict(document: ProfileDocument, id: string, keepLocal: boolean): ProfileDocument {
  const conflict = document.conflicts.find(item => item.id === id);
  if (!conflict) return document;
  const records = packStudy(document.study);
  if (keepLocal) records[conflict.key] = conflict.local;
  return { ...document, study: keepLocal ? unpackStudy(records) : document.study, conflicts: document.conflicts.filter(item => item.id !== id) };
}
