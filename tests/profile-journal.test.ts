import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ProfileStore, type Outbox } from '../src/domain/profile-store.ts';
import { emptyStudy, packStudy, pendingChanges } from '../src/domain/profile-sync.ts';

const owner='00000000-0000-0000-0000-000000000001';
const other='00000000-0000-0000-0000-000000000002';
const migration=new URL('../supabase/migrations/202611200001_compact_journal.sql',import.meta.url);
async function setup() {
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/202611190001_profiles.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1),($2)',[owner,other]);
  await db.exec(`set request.jwt.claim.sub='${owner}';`);
  return db;
}
async function migrate(db:PGlite) {
  if(existsSync(migration)) await db.exec(readFileSync(migration,'utf8'));
}
async function push(db:PGlite,changes:unknown,mutation=crypto.randomUUID()) {
  return (await db.query<any>('select public.sync_study($1,$2,auth.uid()) as reply',[JSON.stringify(changes),mutation])).rows[0].reply;
}
const change=(id:string,value:unknown,expected=0)=>({id,value,expected});

test('legacy journal compaction preserves retries, current conflicts, tombstones and owner isolation',async()=>{
  const db=await setup();
  try {
    const word='["words","one"]', counter='["practiceDays","2026-11-20"]', deleted='["words","deleted"]';
    const patch=[change(word,{title:'hello',meaning:'привет'}),change(counter,{reviews:1}),change(deleted,null)];
    const mutation=crypto.randomUUID(), first=await push(db,patch,mutation);
    // A stale request conflicts, then another device updates that row before replay.
    const conflictMutation=crypto.randomUUID(), conflictPatch=[change(word,{title:'stale'})];
    await push(db,conflictPatch,conflictMutation);
    await migrate(db);
    const before=(await db.query('select * from study_records order by id')).rows;
    assert.equal((await db.query<any>('select public.compact_study_mutations(1) as count')).rows[0].count,1);
    assert.equal((await db.query<any>('select public.compact_study_mutations(1000) as count')).rows[0].count,1);
    assert.equal((await db.query<any>('select public.compact_study_mutations(1000) as count')).rows[0].count,0);
    assert.deepEqual((await db.query('select * from study_records order by id')).rows,before);
    const updated=await push(db,[change(word,{title:'newer'},first.applied[0].revision),change(counter,{reviews:2},first.applied[1].revision)]);
    const records=(await db.query('select * from study_records order by id')).rows;
    assert.deepEqual(await push(db,patch,mutation),first,'old applied values and revisions must be exactly replayed');
    assert.deepEqual((await db.query('select * from study_records order by id')).rows,records,'retry must not write again');
    const retriedConflict=await push(db,conflictPatch,conflictMutation);
    assert.deepEqual(retriedConflict.conflicts,[updated.applied[0]],'conflicts may advance to current values');
    await assert.rejects(push(db,[change(word,{title:'changed payload'})],mutation),/Mutation payload changed/);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${other}';`);
    assert.equal((await db.query('select * from study_records')).rows.length,0);
    await assert.rejects(db.query('select public.compact_study_mutations(1)'),/permission denied/);
    await assert.rejects(db.query("select public.study_compact_response('{}'::jsonb)"),/permission denied/);
    await assert.rejects(db.query("select public.study_replay_response('{}'::jsonb,'[]'::jsonb,auth.uid())"),/permission denied/);
    await assert.rejects(db.query('select * from study_mutations'),/permission denied/);
    await assert.rejects(db.query('select public.sync_study($1,$2,$3)',[JSON.stringify(patch),mutation,owner]),/Authentication required/);
    assert.equal((await push(db,patch,mutation)).applied.length,3,'mutation IDs are isolated per owner');
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select public.compact_study_mutations(1)'),/permission denied/);
  } finally { await db.close(); }
});

test('new journal omits copied values, bounds maintenance, and retains duplicate-ID legacy responses',async()=>{
  const db=await setup();
  try {
    const duplicateId='["words","duplicate"]', mutation=crypto.randomUUID();
    const duplicates=[change(duplicateId,{title:'first'}),change(duplicateId,{title:'second'},1)];
    const original=await push(db,duplicates,mutation);
    await migrate(db);
    await db.query('select public.compact_study_mutations(1000)');
    assert.deepEqual(await push(db,duplicates,mutation),original);
    assert.equal((await db.query<any>('select public.compact_study_mutations(1000) as count')).rows[0].count,0);
    const patch=Array.from({length:200},(_,i)=>change(JSON.stringify(['words',`large-${i}`]),{title:`word ${i}`,definition:'Learning vocabulary and expressions. '.repeat(150)}));
    const id=crypto.randomUUID(), reply=await push(db,patch,id);
    const stored=(await db.query<any>('select response from study_mutations where mutation=$1',[id])).rows[0].response;
    assert.ok(JSON.stringify(stored).length<JSON.stringify(reply).length/10,'receipt should contain no large copied values');
    assert.deepEqual(await push(db,patch,id),reply);
    await assert.rejects(db.query('select public.compact_study_mutations(0)'),/Invalid maintenance batch/);
    await assert.rejects(db.query('select public.compact_study_mutations(1001)'),/Invalid maintenance batch/);
  } finally { await db.close(); }
});

test('lost acknowledgment replays through ProfileStore after cleanup without double counting local progress',async()=>{
  const db=await setup();
  let store:ProfileStore|undefined;
  try {
    await migrate(db);
    const study=emptyStudy(); study.practiceDays={'2026-11-20':{reviews:1}} as any;
    study.words=[{id:'clash',language:'en',title:'local',meaning:'местный',example:''}];
    const wordKey=JSON.stringify(['words','clash']);
    await push(db,[change(wordKey,{...study.words[0],title:'remote'})]);
    const initial={study,base:{},cursor:0,conflicts:[]};
    // A durable outbox already exists: its counter applies, but the word conflicts.
    const doc={...initial,outbox:{mutation:crypto.randomUUID(),changes:pendingChanges(initial)}};
    let lost=true;
    const transport={
      pull:async(cursor:number)=>(await db.query<any>('select id,value,revision::float8 as revision from study_records where revision>$1 order by revision limit 200',[cursor])).rows,
      push:async(batch:Outbox)=>{
        const reply=await push(db,batch.changes,batch.mutation);
        if(lost){lost=false;throw new Error('lost acknowledgment');}
        return reply;
      }
    };
    store=new ProfileStore(owner,doc,async()=>{},transport);
    await store.sync(); assert.equal(store.status.state,'error'); assert.ok(store.document.outbox);
    await db.query('select public.compact_study_mutations(1000)');
    // Another device has already applied one additional review.
    const key=JSON.stringify(['practiceDays','2026-11-20']);
    const revision=(await db.query<any>('select revision::float8 as revision from study_records where id=$1',[key])).rows[0].revision;
    await push(db,[change(key,{reviews:2},revision)]);
    const saved=structuredClone(store.document); store.dispose();
    store=new ProfileStore(owner,saved,async()=>{},transport);
    await store.sync(); assert.equal(store.status.state,'synced');
    assert.equal((store.getStudy().practiceDays!['2026-11-20'] as any).reviews,2);
    assert.equal((await db.query<any>('select value from study_records where id=$1',[key])).rows[0].value.reviews,2);
    assert.equal(Object.keys(packStudy(store.getStudy())).length,Object.keys(packStudy(study)).length);
  } finally { store?.dispose(); await db.close(); }
});
