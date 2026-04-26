insert into storage.buckets (id, name, public)
values ('style-inspirations', 'style-inspirations', true)
on conflict (id) do nothing;

create policy "style_inspirations_public_read"
on storage.objects
for select
using (bucket_id = 'style-inspirations');