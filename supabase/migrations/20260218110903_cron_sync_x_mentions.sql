create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Remove old staggered jobs if they exist
select cron.unschedule(j.jobname)
  from cron.job j
  where j.jobname like 'sync-x-mentions%';

-- Single cron job: fires every minute, loops 12x with 5s sleep = ~5s effective polling.
-- pg_cron minimum interval is 1 minute; internal loop is the workaround.
-- pg_net.http_post sends async HTTP from inside Postgres to our Edge Function.
--
-- NOTE: URL uses http://kong:8000 (Supabase internal Docker network).
-- For production, replace with your deployed Supabase URL.
select cron.schedule(
  'sync-x-mentions-5s-loop',
  '* * * * *',
  $outer$
  do $inner$
  declare
    _base_url text := coalesce(
      nullif(current_setting('app.settings.supabase_url', true), ''),
      'http://kong:8000'
    );
    _service_key text := coalesce(
      nullif(current_setting('app.settings.service_role_key', true), ''),
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    );
    _url text := _base_url || '/functions/v1/sync-x-mentions';
    _headers jsonb := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    );
    _i int;
  begin
    for _i in 0..11 loop
      perform net.http_post(
        url := _url,
        headers := _headers,
        body := jsonb_build_object('source', 'pg_cron', 'iteration', _i)
      );
      if _i < 11 then
        perform pg_sleep(5);
      end if;
    end loop;
  end
  $inner$;
  $outer$
);
