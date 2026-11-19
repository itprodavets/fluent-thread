import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProfileStore } from '../src/domain/profile-store.ts';
import { emptyStudy, packStudy } from '../src/domain/profile-sync.ts';
import type { StoredProfile, SyncTransport, Outbox } from '../src/domain/profile-store.ts';
const fresh = ():StoredProfile => ({study:emptyStudy(),base:{},cursor:0,conflicts:[]});
test('failed network keeps durable outbox; retry does not overwrite later local edits', async () => {
  let saved=fresh(),fail=true,clock=0;
  const replies=new Map<string, any>(); const rows=new Map<string,any>();
  const transport:SyncTransport={pull:async cursor=>[...rows.values()].filter(row=>row.revision>cursor),push:async batch=>{
    if (!replies.has(batch.mutation)) {
      const applied=batch.changes.map(change=>({id:change.id,value:change.value,revision:++clock}));
      for (const row of applied) rows.set(row.id,row);
      replies.set(batch.mutation,{applied,conflicts:[]});
    }
    if(fail){fail=false;throw new Error('offline');} return replies.get(batch.mutation);
  }};
  const store=new ProfileStore('a',fresh(),async doc=>{saved=structuredClone(doc);},transport);
  await store.update(s=>({...s,profileName:'Denis'})); await store.sync();
  assert.equal(store.status.state,'error'); assert.ok(saved.outbox);
  await store.update(s=>({...s,profileName:'Denis K'})); await store.sync();
  assert.equal(store.status.state,'synced'); assert.equal(store.getStudy().profileName,'Denis K');
  assert.equal(saved.outbox,undefined); store.dispose();
});
test('switching accounts rejects old writes and late cloud replies', async () => {
  let finish!:(rows:any[])=>void;
  const store=new ProfileStore('a',fresh(),async()=>{}, {pull:()=>new Promise(resolve=>{finish=resolve;}),push:async()=>({applied:[],conflicts:[]})});
  const run=store.sync(); store.dispose();
  assert.equal(await store.update(s=>({...s,profileName:'wrong'})),false);
  finish([{id:JSON.stringify(['field','profileName']),value:'old account',revision:1}]);
  await run; assert.equal(store.getStudy().profileName,undefined);
});
test('new device pulls cloud data before making its initial writes', async () => {
  const records=packStudy({...emptyStudy(),profileName:'Kseniia'});
  const remote=Object.entries(records).map(([id,value],i)=>({id,value,revision:i+1}));
  let writes=0;
  const store=new ProfileStore('b',fresh(),async()=>{}, {pull:async cursor=>remote.filter(row=>row.revision>cursor),push:async()=>{writes++;return{applied:[],conflicts:[]};}});
  await store.sync(); assert.equal(writes,0); assert.equal(store.getStudy().profileName,'Kseniia'); store.dispose();
});

test('two devices sync vocabulary, merge independent edits, and propagate deletions without resurrection', async () => {
  const rows=new Map<string,any>(), journal=new Map<string,any>(); let revision=0;
  const transport:SyncTransport={
    pull:async cursor=>[...rows.values()].filter(row=>row.revision>cursor).sort((a,b)=>a.revision-b.revision).slice(0,200),
    push:async batch=>{
      if(journal.has(batch.mutation)) return journal.get(batch.mutation);
      const applied:any[]=[],conflicts:any[]=[];
      for(const change of batch.changes){
        const before=rows.get(change.id);
        if((before?.revision??0)!==change.expected) conflicts.push(before??{id:change.id,value:null,revision:0});
        else {const row={id:change.id,value:structuredClone(change.value),revision:++revision}; rows.set(row.id,row);applied.push(row);}
      }
      const reply={applied,conflicts}; journal.set(batch.mutation,reply);return reply;
    }
  };
  const a=new ProfileStore('same-user',fresh(),async()=>{},transport);
  const b=new ProfileStore('same-user',fresh(),async()=>{},transport);
  try{
    await a.update(s=>({...s,words:[{id:'w',language:'en',title:'hello',meaning:'привет',example:'Hello!'}]}));
    await a.sync(); await b.sync();
    assert.deepEqual(b.getStudy().words,a.getStudy().words);
    await a.update(s=>({...s,words:s.words.map(w=>({...w,ownExamples:['Hello, everyone!']}))}));
    await b.update(s=>({...s,words:s.words.map(w=>({...w,meaning:'здравствуйте'}))}));
    await b.sync(); await a.sync(); await b.sync();
    assert.equal(a.getStudy().words[0].meaning,'здравствуйте');
    assert.deepEqual(b.getStudy().words[0].ownExamples,['Hello, everyone!']);
    await a.update(s=>({...s,words:s.words.map(w=>({...w,title:'hi'}))}));
    await b.update(s=>({...s,words:[]})); await b.sync(); await a.sync();
    assert.equal(a.getStudy().words.length,0); assert.equal(a.document.conflicts.length,1);
    await a.sync(); await b.sync(); assert.equal(b.getStudy().words.length,0);
  } finally {a.dispose();b.dispose();}
});

test('cursor-only checkpoints replay safely after restart without rewriting the study snapshot',async()=>{
 const doc=fresh(),key=JSON.stringify(['words','w']);
 const word={id:'w',language:'en',title:'hello',meaning:'привет',example:'Hello!'};
 doc.study.words=[word];
 doc.base=Object.fromEntries(Object.entries(packStudy(doc.study)).map(([id,value])=>[id,{value,revision:id===key?50:1}]));
 let writes=0; const saved=structuredClone(doc);
 const transport:SyncTransport={pull:async cursor=>cursor<50?[{id:key,value:word,revision:50}]:[],push:async()=>{throw new Error('nothing to push');}};
 const a=new ProfileStore('same',structuredClone(saved),async()=>{writes++;},transport);
 await a.sync(); assert.equal(a.document.cursor,50);assert.equal(a.status.state,'synced');a.dispose();
 const b=new ProfileStore('same',structuredClone(saved),async()=>{writes++;},transport);
 await b.sync();assert.deepEqual(b.getStudy().words,[word]);assert.equal(b.status.state,'synced');b.dispose();
 assert.equal(writes,0,'replaying acknowledged rows should not rewrite a large unchanged snapshot');
});
