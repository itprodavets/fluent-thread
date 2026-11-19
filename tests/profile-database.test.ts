import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('database scopes reads/writes to two identities and retries are idempotent', async () => {
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon;
      grant execute on function auth.uid() to authenticated,anon;`);
    await db.exec(readFileSync(new URL('../supabase/migrations/202611190001_profiles.sql',import.meta.url),'utf8'));
    await db.exec(readFileSync(new URL('../supabase/migrations/202611200001_compact_journal.sql',import.meta.url),'utf8'));
    const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
    await db.query('insert into auth.users values($1),($2)',[a,b]);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
    const patch=JSON.stringify([{id:'["words","one"]',value:{title:'hello'},expected:0}]);
    const mutation='10000000-0000-0000-0000-000000000001';
    const first=await db.query('select sync_study($1,$2,auth.uid()) as result',[patch,mutation]);
    const retry=await db.query('select sync_study($1,$2,auth.uid()) as result',[patch,mutation]);
    assert.deepEqual(retry.rows,first.rows);
    await db.exec(`set request.jwt.claim.sub='${b}';`);
    await assert.rejects(db.query('select sync_study($1,$2,$3)',[patch,mutation,a]));
    assert.equal((await db.query('select * from study_records')).rows.length,0);
    await assert.rejects(db.query('update study_records set value=$1',[{}]));
    await assert.rejects(db.query('insert into study_profiles(id) values($1)',[a]));
    await db.query('select sync_study($1,$2,auth.uid())',[patch,mutation]);
    assert.equal((await db.query('select * from study_records')).rows.length,1);
    await db.exec(`set request.jwt.claim.sub='${a}';`);
    const clash=await db.query<any>('select sync_study($1,$2,auth.uid()) as result',[patch,'10000000-0000-0000-0000-000000000002']);
    assert.equal(clash.rows[0].result.conflicts.length,1);
    assert.equal(clash.rows[0].result.applied.length,0);
    const longId=JSON.stringify(['words',Array.from({length:180},()=>crypto.randomUUID()).join('')]);
    const longPatch=JSON.stringify([{id:longId,value:{title:'long definition'},expected:0}]);
    await db.query('select sync_study($1,$2,auth.uid())',[longPatch,crypto.randomUUID()]);
    assert.equal((await db.query('select * from study_records where id=$1',[longId])).rows.length,1);
    await db.exec('reset role; set role anon;');
    assert.equal((await db.query<any>('select fluent_thread_schema_version() as version')).rows[0].version,1);
    await assert.rejects(db.query('select * from study_records'));
    await assert.rejects(db.query('select sync_study($1,$2,auth.uid())',[patch,mutation]));
  } finally { await db.close(); }
});
