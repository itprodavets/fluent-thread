import assert from 'node:assert/strict';
import { test } from 'node:test';
import 'fake-indexeddb/auto';
import { ProfileStore } from '../src/domain/profile-store.ts';
import { assess } from '../src/domain/model.ts';
import { emptyStudy } from '../src/domain/profile-sync.ts';
import { transactProfile } from '../src/domain/profile-database.ts';
import type { StoredProfile } from '../src/domain/profile-store.ts';
const fresh=():StoredProfile=>({study:emptyStudy(),base:{},cursor:0,conflicts:[]});
const persistence=(id:string)=>({transact:(previous:StoredProfile,change:(doc:StoredProfile)=>StoredProfile)=>transactProfile(id,previous,change)});

test('two open tabs save against the latest durable profile without losing concurrent edits',async()=>{
  const id=crypto.randomUUID();
  const a=new ProfileStore(id,fresh(),persistence(id));
  const b=new ProfileStore(id,fresh(),persistence(id));
  const word=(id:string)=>({id,language:'en',title:id,meaning:id,example:''});
  try {
    await Promise.all([a.update(s=>({...s,words:[...s.words,word('a')]})),b.update(s=>({...s,words:[...s.words,word('b')]}))]);
    await a.refresh(); await b.refresh();
    assert.deepEqual(a.getStudy().words.map(w=>w.id).sort(),['a','b']);
    assert.deepEqual(b.getStudy().words,a.getStudy().words);
    await b.update(s=>({...s,words:s.words.filter(w=>w.id!=='a')}));
    await a.update(s=>({...s,profileName:'Updated in another tab'}));
    await b.refresh();
    assert.deepEqual(b.getStudy().words.map(w=>w.id),['b'],'an old tab must not resurrect a deleted word');
    assert.equal(b.getStudy().profileName,'Updated in another tab');
    const now=Date.parse('2026-11-20T06:00:00Z');
    await Promise.all([a.update(s=>assess(s,'b','independent',now,'spoken')),b.update(s=>assess(s,'b','independent',now,'spoken'))]);
    await a.refresh();
    assert.equal(a.getStudy().results.b.attempts,2,'two tab actions must both be counted');
  } finally {a.dispose();b.dispose();}
});

test('saving before closing waits for in-flight sync and preserves accepted writes on close',async()=>{
  let saved=fresh(),release!:()=>void;
  const store=new ProfileStore('close',fresh(),async doc=>{saved=structuredClone(doc);},
    {pull:()=>new Promise(resolve=>{release=()=>resolve([]);}),push:async batch=>({applied:batch.changes.map((c,i)=>({id:c.id,value:c.value,revision:i+1})),conflicts:[]})});
  const syncing=store.sync();
  let finished=false;
  const saving=store.saveBeforeClosing().then(()=>{finished=true;});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(finished,false,'save must await an already running network request');
  store.setTransport(undefined); release(); await syncing; await saving;
  const writing=store.update(s=>({...s,profileName:'Accepted before close'}));
  const closing=store.close();
  assert.equal(await writing,true);
  await closing;
  assert.equal(saved.study.profileName,'Accepted before close');
  assert.equal(await store.update(s=>({...s,profileName:'Too late'})),false);
});

test('a late acknowledgement cannot clear another tab’s newer durable outbox',async()=>{
  const id=crypto.randomUUID(), a=crypto.randomUUID(), b=crypto.randomUUID(), key='["field","profileName"]';
  const doc={...fresh(),study:{...emptyStudy(),profileName:'first'},outbox:{mutation:a,changes:[{id:key,value:'first',expected:0}]}};
  await transactProfile(id,fresh(),()=>doc);
  let acknowledge!:(value:any)=>void, started!:()=>void;
  const ready=new Promise<void>(resolve=>{started=resolve;});
  const pushed:string[]=[];
  const store=new ProfileStore(id,doc,persistence(id),{
    pull:async()=>[],
    push:async batch=>{
      pushed.push(batch.mutation);
      if(batch.mutation===a) return new Promise(resolve=>{acknowledge=resolve;started();});
      return {applied:batch.changes.map(change=>({id:change.id,value:change.value,revision:2})),conflicts:[]};
    }
  });
  try {
    const syncing=store.sync();await ready;
    await transactProfile(id,doc,current=>({...current,study:{...current.study,profileName:'second'},base:{...current.base,[key]:{value:'first',revision:1}},outbox:{mutation:b,changes:[{id:key,value:'second',expected:1}]}}));
    acknowledge({applied:[{id:key,value:'first',revision:1}],conflicts:[]});
    await syncing;
    assert.deepEqual(pushed.slice(0,2),[a,b],'the exact already-durable second mutation must be retried');
    assert.equal(store.getStudy().profileName,'second');
    assert.equal(store.document.outbox,undefined);
  } finally {store.dispose();}
});

test('a closed notification channel cannot turn a committed save into a failure',async()=>{
  const id=crypto.randomUUID();
  const saved=await transactProfile(id,fresh(),doc=>({...doc,study:{...doc.study,profileName:'saved'}}),()=>{throw new Error('channel already closed');});
  assert.equal(saved.study.profileName,'saved');
});
