-- Shared project only. Run once after installing the storage-policy migration.
-- Preserve every existing cloud profile. No learning data is removed.
begin;
lock table public.study_storage_settings in exclusive mode;
insert into public.study_cloud_members(user_id)
  select id from public.study_profiles
  where not (select shared_mode from public.study_storage_settings where singleton)
  on conflict do nothing;
update public.study_storage_settings set shared_mode=true where singleton;
commit;
