import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('shared activation preserves existing profiles and prevents new accounts uploading study data through any RPC', async () => {
  const db = new PGlite();
  const a = '00000000-0000-0000-0000-000000000001', b = '00000000-0000-0000-0000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
    for (const file of ['202611190001_profiles.sql','202611200001_compact_journal.sql','202611200002_storage_policy.sql']) {
      const path = new URL('../supabase/migrations/' + file, import.meta.url);
      if (existsSync(path)) await db.exec(readFileSync(path,'utf8'));
    }
    await db.query('insert into auth.users values($1),($2)',[a,b]);
    const patch = JSON.stringify([{id:'["words","one"]',value:{title:'hello'},expected:0}]);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
    await db.query('select sync_study($1,$2,auth.uid())',[patch,crypto.randomUUID()]);
    await db.exec('reset role;');
    const activation = new URL('../supabase/maintenance/enable-shared-local-default.sql',import.meta.url);
    if (existsSync(activation)) await db.exec(readFileSync(activation,'utf8'));
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
    assert.equal((await db.query<any>('select study_storage_mode() as mode')).rows[0].mode,'cloud');
    assert.equal((await db.query('select * from study_records')).rows.length,1);
    await db.exec(`set request.jwt.claim.sub='${b}';`);
    assert.equal((await db.query<any>('select study_storage_mode() as mode')).rows[0].mode,'local');
    await assert.rejects(db.query('select sync_study($1,$2,auth.uid())',[patch,crypto.randomUUID()]));
    await assert.rejects(db.query('select sync_study_internal($1,$2,auth.uid())',[patch,crypto.randomUUID()]));
    await assert.rejects(db.query('insert into study_cloud_members(user_id) values(auth.uid())'));
    await assert.rejects(db.query('update study_storage_settings set shared_mode=false'));
    assert.equal((await db.query('select * from study_records')).rows.length,0);
    await db.exec('reset role;');
    assert.equal((await db.query('select * from study_records')).rows.length,1);
    // A personal project's defaults still allow ordinary cloud sync.
    await db.exec(`update study_storage_settings set shared_mode=false; set role authenticated; set request.jwt.claim.sub='${b}';`);
    assert.equal((await db.query<any>('select study_storage_mode() as mode')).rows[0].mode,'cloud');
    await db.query('select sync_study($1,$2,auth.uid())',[patch,crypto.randomUUID()]);
    assert.equal((await db.query('select * from study_records')).rows.length,1);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select study_storage_mode()'));
  } finally { await db.close(); }
});
