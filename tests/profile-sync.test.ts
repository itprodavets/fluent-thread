import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStudy, packStudy, unpackStudy, mergeValue, reconcileRow, pendingChanges } from '../src/domain/profile-sync.ts';

test('study records round trip optional collections, order and future fields', () => {
  const study = { ...emptyStudy(), words: [{ id: 'z', title: 'z' }, { id: 'a', title: 'a' }], future: { custom: true } };
  assert.deepEqual(unpackStudy(packStudy(study as any)), study);
});
test('independent fields and concurrent practice counts combine', () => {
  assert.deepEqual(mergeValue({a:1,b:2}, {a:3,b:2}, {a:1,b:4}).value, {a:3,b:4});
  assert.equal(mergeValue({retry:1},{retry:2},{retry:3},true).value.retry,4);
  assert.equal(mergeValue({retry:0},{retry:1},{retry:1},true).value.retry,2);
});
test('same-field alternatives are visible and deletions are not resurrected', () => {
  const merged = mergeValue({title:'before'}, {title:'mine'}, {title:'theirs'});
  assert.equal(merged.value.title,'theirs'); assert.equal(merged.conflict,true);
  const deleted = mergeValue({title:'before'}, {title:'mine'}, null);
  assert.equal(deleted.value,null); assert.equal(deleted.conflict,true);
});
test('acknowledgment preserves edits made while a request is in flight', () => {
  const doc = { study: emptyStudy(), base: {}, cursor:0, conflicts:[] } as any;
  doc.study.words = [{id:'x', title:'newer'}];
  const key=JSON.stringify(['words','x']);
  const next=reconcileRow(doc,{id:key,value:{id:'x',title:'sent'},revision:1},{id:'x',title:'sent'});
  assert.equal(next.study.words[0].title,'newer');
  assert.equal(pendingChanges(next).find(p=>p.id===key)!.expected,1);
});
test('an acknowledged tombstone stays absent; stale rows cannot roll state backwards', () => {
  const key=JSON.stringify(['words','x']);
  const doc={study:emptyStudy(),base:{[key]:{value:{id:'x',title:'old'},revision:4}},cursor:0,conflicts:[]} as any;
  const next=reconcileRow(doc,{id:key,value:null,revision:5});
  assert.equal(next.study.words.length,0);
  assert.equal(pendingChanges(next).some(p=>p.id===key),false);
  assert.equal(reconcileRow(next,{id:key,value:{id:'x'},revision:3}),next);
});

test('first offline repetitions from two devices combine at the record boundary', () => {
  const study={...emptyStudy(),practiceDays:{en:{'2026-11-19':{spoken:{retry:1}}}}};
  const doc={study,base:{},cursor:0,conflicts:[]} as any;
  const key=JSON.stringify(['practiceDays','en']);
  const next=reconcileRow(doc,{id:key,value:{'2026-11-19':{spoken:{retry:1}}},revision:1});
  assert.equal(next.study.practiceDays!.en['2026-11-19'].spoken!.retry,2);
  assert.equal(next.conflicts.length,0);
});
