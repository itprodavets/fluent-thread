-- Optional shared-project restriction. Personal installations retain full sync by default.
begin;
create table public.study_storage_settings (
  singleton boolean primary key default true check (singleton),
  shared_mode boolean not null default false
);
insert into public.study_storage_settings(singleton) values(true);
create table public.study_cloud_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.study_storage_settings enable row level security;
alter table public.study_cloud_members enable row level security;
revoke all on public.study_storage_settings, public.study_cloud_members from public, anon, authenticated;

create function public.study_storage_mode() returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return case when not (select shared_mode from public.study_storage_settings where singleton)
    or exists(select 1 from public.study_cloud_members where user_id=auth.uid()) then 'cloud' else 'local' end;
end;
$$;
revoke all on function public.study_storage_mode() from public, anon;
grant execute on function public.study_storage_mode() to authenticated;

alter function public.sync_study(jsonb,uuid,uuid) rename to sync_study_internal;
-- The journal RPC qualifies its mutation parameter with its original function name.
do $$ begin
  execute replace(pg_get_functiondef('public.sync_study_internal(jsonb,uuid,uuid)'::regprocedure),
    'sync_study.mutation', 'sync_study_internal.mutation');
end $$;
revoke all on function public.sync_study_internal(jsonb,uuid,uuid) from public, anon, authenticated;
create function public.sync_study(changes jsonb, mutation uuid, owner_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize policy activation with in-flight writes, without touching learning rows.
  perform 1 from public.study_storage_settings where singleton for share;
  if auth.uid() is null or owner_id is distinct from auth.uid() or public.study_storage_mode() <> 'cloud' then
    raise exception 'Study data stays on this device. Connect your own database for sync.' using errcode='42501';
  end if;
  return public.sync_study_internal(changes,mutation,owner_id);
end;
$$;
revoke all on function public.sync_study(jsonb,uuid,uuid) from public, anon;
grant execute on function public.sync_study(jsonb,uuid,uuid) to authenticated;
drop policy own_records on public.study_records;
create policy own_records on public.study_records for select to authenticated
  using(user_id=(select auth.uid()) and (select public.study_storage_mode())='cloud');
commit;
