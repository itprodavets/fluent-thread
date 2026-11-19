-- Per-user records, tombstones and an idempotent conditional-write API.
create table public.study_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 120),
  revision bigint not null default 0 check (revision >= 0)
);
create function public.study_record_key(value text) returns bytea
language sql immutable strict parallel safe set search_path = '' as $$
  select sha256(convert_to(value, 'UTF8'));
$$;
create table public.study_records (
  user_id uuid not null references public.study_profiles(id) on delete cascade,
  id text not null check (length(id) between 1 and 1000000),
  record_key bytea generated always as (public.study_record_key(id)) stored,
  value jsonb not null,
  revision bigint not null,
  primary key (user_id, record_key)
);
create index study_records_cursor on public.study_records(user_id, revision);
create table public.study_mutations (
  user_id uuid not null references public.study_profiles(id) on delete cascade,
  mutation uuid not null,
  fingerprint text not null,
  response jsonb not null,
  primary key (user_id, mutation)
);
alter table public.study_profiles enable row level security;
alter table public.study_records enable row level security;
alter table public.study_mutations enable row level security;
create policy own_profile on public.study_profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy own_records on public.study_records for select to authenticated using (user_id = (select auth.uid()));
-- Mutations have no browser policy or grants. They are only accessed inside the scoped RPC.
revoke all on public.study_profiles, public.study_records, public.study_mutations from anon, authenticated;
grant select on public.study_profiles, public.study_records to authenticated;
grant insert (id, display_name), update (display_name) on public.study_profiles to authenticated;

create function public.sync_study(changes jsonb, mutation uuid, owner_id uuid)
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
    return previous.response;
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
  insert into public.study_mutations(user_id, mutation, fingerprint, response) values(owner, mutation, fingerprint, response);
  return response;
end;
$$;
revoke all on function public.sync_study(jsonb, uuid, uuid) from public, anon;
grant execute on function public.sync_study(jsonb, uuid, uuid) to authenticated;
