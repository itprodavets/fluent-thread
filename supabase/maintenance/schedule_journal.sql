-- Run as the database owner AFTER migrations/202611200001_compact_journal.sql.
-- Named schedules are idempotent. Supabase pg_cron uses UTC.
create extension if not exists pg_cron;

do $$ begin
  if coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC', 'Etc/UTC') then
    raise exception 'Journal schedules require cron.timezone UTC/GMT; no jobs were changed';
  end if;
end $$;

select cron.schedule('fluent-thread-journal-maintenance', '0 20 * * *', $job$
  select public.compact_study_mutations(1000);
  delete from cron.job_run_details
    where jobid in (select jobid from cron.job where jobname in (
      'fluent-thread-journal-maintenance', 'fluent-thread-journal-vacuum'
    )) and end_time < now() - interval '7 days';
$job$);

-- Standard VACUUM allows reads/writes and reuses freed space. Never VACUUM FULL.
select cron.schedule('fluent-thread-journal-vacuum', '10 20 * * *',
  'vacuum (analyze) public.study_mutations;');
