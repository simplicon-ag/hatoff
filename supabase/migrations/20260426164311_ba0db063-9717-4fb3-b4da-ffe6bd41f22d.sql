UPDATE public.curated_looks
SET
  product_handles = ARRAY['venti-businesshemd-dunkelblau','casa-moda-jeans-steve-14742','venti-sakko-5265'],
  anchor_handle = 'venti-businesshemd-dunkelblau',
  updated_at = now()
WHERE slug = 'urban-night-blue-chic';