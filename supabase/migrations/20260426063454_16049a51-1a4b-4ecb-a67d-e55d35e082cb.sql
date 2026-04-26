create table public.style_inspiration_cache (
  id uuid primary key default gen_random_uuid(),
  product_handle text not null,
  slot text not null check (slot in ('office','weekend','evening')),
  image_url text not null,
  source_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_handle, slot)
);

alter table public.style_inspiration_cache enable row level security;

create policy "style_inspiration_cache_public_read"
on public.style_inspiration_cache
for select
using (true);

create index style_inspiration_cache_handle_idx
on public.style_inspiration_cache (product_handle);