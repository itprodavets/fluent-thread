-- Retain replay receipts indefinitely, but stop duplicating vocabulary/progress values.
-- Existing clients still send and receive exactly the same RPC shape.
begin;

create function public.study_compact_response(payload jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  total bigint;
  distinct_ids bigint;
begin
  select count(*), count(distinct item->>'id') into total, distinct_ids
  from jsonb_array_elements((payload->'applied') || (payload->'conflicts')) item;
  -- Historical duplicate-ID batches cannot be reconstructed unambiguously.
  if total <> distinct_ids then return payload || '{"compact":false}'::jsonb; end if;
  return jsonb_build_object(
    'compact', true,
    'applied', coalesce((select jsonb_object_agg(encode(public.study_record_key(item->>'id'), 'hex'), item->'revision')
      from jsonb_array_elements(payload->'applied') item), '{}'::jsonb),
    'conflicts', coalesce((select jsonb_agg(encode(public.study_record_key(item->>'id'), 'hex'))
      from jsonb_array_elements(payload->'conflicts') item), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.study_compact_response(jsonb) from public, anon, authenticated;

create function public.study_replay_response(receipt jsonb, changes jsonb, owner_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  with requested as (
    select item, ordinal, public.study_record_key(item->>'id') as record_key
    from jsonb_array_elements(changes) with ordinality as request(item, ordinal)
  )
  select jsonb_build_object(
    'applied', coalesce(jsonb_agg(jsonb_build_object(
      'id', request.item->>'id', 'value', request.item->'value',
      'revision', (receipt->'applied'->>encode(request.record_key, 'hex'))::bigint
    ) order by request.ordinal) filter (where (receipt->'applied') ? encode(request.record_key, 'hex')), '[]'::jsonb),
    'conflicts', coalesce(jsonb_agg(jsonb_build_object(
      'id', request.item->>'id', 'value', coalesce(record.value, 'null'::jsonb),
      'revision', coalesce(record.revision, 0)
    ) order by request.ordinal) filter (where (receipt->'conflicts') ? encode(request.record_key, 'hex')), '[]'::jsonb)
  )
  from requested request left join public.study_records record
    on record.user_id = owner_id and record.record_key = request.record_key and record.id = request.item->>'id';
$$;
revoke all on function public.study_replay_response(jsonb, jsonb, uuid) from public, anon, authenticated;

-- The partial index excludes finished receipts, including retained duplicate-ID batches.
create index study_mutations_pending_compaction on public.study_mutations(user_id, mutation)
  where not (response ? 'compact');

create function public.compact_study_mutations(batch_size integer default 1000) returns integer
language plpgsql security definer set search_path = '' as $$
declare processed integer;
begin
  if batch_size is null or batch_size < 1 or batch_size > 1000 then
    raise exception 'Invalid maintenance batch' using errcode = '22023';
  end if;
  with candidates as (
    select user_id, mutation from public.study_mutations
    where not (response ? 'compact') order by user_id, mutation
    limit batch_size for update skip locked
  )
  update public.study_mutations m set response = public.study_compact_response(m.response)
    from candidates c where m.user_id = c.user_id and m.mutation = c.mutation;
  get diagnostics processed = row_count;
  return processed;
end;
$$;
revoke all on function public.compact_study_mutations(integer) from public, anon, authenticated;

create or replace function public.sync_study(changes jsonb, mutation uuid, owner_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := auth.uid();
  clock bigint;
  item jsonb;
  current_row public.study_records%rowtype;
  previous public.study_mutations%rowtype;
  fingerprint text := md5(changes::text);
  applied jsonb := '[]'::jsonb;
  conflicts jsonb := '[]'::jsonb;
  response jsonb;
begin
  if owner is null or owner <> owner_id or owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) > 200 or octet_length(changes::text) > 8000000 or mutation is null then
    raise exception 'Invalid sync batch' using errcode = '22023';
  end if;
  insert into public.study_profiles(id) values(owner) on conflict do nothing;
  select p.revision into clock from public.study_profiles p where p.id = owner for update;
  select * into previous from public.study_mutations m where m.user_id = owner and m.mutation = sync_study.mutation;
  if found then
    if previous.fingerprint <> fingerprint then raise exception 'Mutation payload changed' using errcode = '22023'; end if;
    if previous.response->>'compact' = 'true' then
      -- The fingerprint is checked above. Applied values come from the exact original
      -- request; conflicts use current rows, read under the same per-owner lock.
      return public.study_replay_response(previous.response, changes, owner);
    end if;
    return previous.response - 'compact';
  end if;
  for item in select * from jsonb_array_elements(changes) loop
    if jsonb_typeof(item->'id') <> 'string' or length(item->>'id') not between 1 and 1000000
      or not (item ? 'value') or jsonb_typeof(item->'expected') <> 'number' or (item->>'expected')::bigint < 0 then
      raise exception 'Invalid record' using errcode = '22023';
    end if;
    select * into current_row from public.study_records r where r.user_id = owner and r.record_key = public.study_record_key(item->>'id') and r.id = item->>'id';
    if coalesce(current_row.revision, 0) <> (item->>'expected')::bigint then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object('id', item->>'id', 'value', coalesce(current_row.value, 'null'::jsonb), 'revision', coalesce(current_row.revision, 0)));
    else
      clock := clock + 1;
      insert into public.study_records(user_id, id, value, revision) values(owner, item->>'id', item->'value', clock)
        on conflict (user_id, record_key) do update set value = excluded.value, revision = excluded.revision;
      applied := applied || jsonb_build_array(jsonb_build_object('id', item->>'id', 'value', item->'value', 'revision', clock));
    end if;
  end loop;
  update public.study_profiles p set revision = clock where p.id = owner;
  response := jsonb_build_object('applied', applied, 'conflicts', conflicts);
  insert into public.study_mutations(user_id, mutation, fingerprint, response) values(owner, mutation, fingerprint, public.study_compact_response(response));
  return response;
end;
$$;
revoke all on function public.sync_study(jsonb, uuid, uuid) from public, anon;
grant execute on function public.sync_study(jsonb, uuid, uuid) to authenticated;


commit;
