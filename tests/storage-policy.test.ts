import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storagePolicyResult, isLegacyPersonalProject } from '../src/domain/storage-policy.ts';

test('shared policy is obeyed even when its URL was entered as a custom database', () => {
  assert.equal(storagePolicyResult('local', null, false), 'local');
  assert.equal(storagePolicyResult('cloud', null, false), 'cloud');
});
test('only a definitively absent RPC in a different personal project permits legacy sync', () => {
  assert.equal(storagePolicyResult(null, { code: 'PGRST202' }, true), 'cloud');
  assert.throws(() => storagePolicyResult(null, { code: 'PGRST202' }, false));
  assert.throws(() => storagePolicyResult(null, { code: 'NETWORK' }, true));
  assert.throws(() => storagePolicyResult('unexpected', null, true));
});

test('shared origin cannot become a legacy personal project through URL spelling', () => {
  assert.equal(isLegacyPersonalProject('custom','https://shared.supabase.co','https://SHARED.supabase.co:443/'),false);
  assert.equal(isLegacyPersonalProject('custom','https://own.supabase.co','https://shared.supabase.co/'),true);
  assert.equal(isLegacyPersonalProject('default','https://own.supabase.co','https://shared.supabase.co'),false);
});
