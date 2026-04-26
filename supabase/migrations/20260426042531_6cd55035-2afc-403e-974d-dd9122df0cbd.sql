create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.product_import_log
  add column if not exists update_mode boolean not null default false;

-- Drop existing schedule if present (idempotent re-run safe)
do $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'product-import-tick';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end$$;

select cron.schedule(
  'product-import-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://xccffclxvdmwfgydebqx.supabase.co/functions/v1/product-import-run',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjY2ZmY2x4dmRtd2ZneWRlYnF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDAxNjUsImV4cCI6MjA5MjYxNjE2NX0.rJ-cRQ6N27pocAkWGRzcNU8BrgpfFIkGLNzjPk8eiSY"}'::jsonb,
    body := '{"batch_size":3,"only_if_running":true}'::jsonb
  ) as request_id;
  $$
);