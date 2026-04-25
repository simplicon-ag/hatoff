create table public.product_import_log (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  source_url text not null unique,
  handle text,
  shopify_product_id text,
  status text not null default 'pending',
  dry_run boolean not null default false,
  scraped_data jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_import_log_status_idx on public.product_import_log(status);
create index product_import_log_brand_idx on public.product_import_log(brand);

alter table public.product_import_log enable row level security;

create policy "Public can read import log"
on public.product_import_log
for select
to public
using (true);

create table public.product_import_job (
  id text primary key,
  state text not null default 'idle',
  dry_run boolean not null default true,
  total integer not null default 0,
  processed integer not null default 0,
  created_count integer not null default 0,
  error_count integer not null default 0,
  message text,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.product_import_job (id, state) values ('singleton', 'idle');

alter table public.product_import_job enable row level security;

create policy "Public can read import job"
on public.product_import_job
for select
to public
using (true);
