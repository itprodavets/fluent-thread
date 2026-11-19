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
