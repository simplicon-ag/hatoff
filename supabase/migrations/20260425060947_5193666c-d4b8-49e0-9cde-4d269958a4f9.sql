ALTER TABLE public.product_price_cache
  ADD COLUMN IF NOT EXISTS original_price_eur numeric,
  ADD COLUMN IF NOT EXISTS original_price_chf numeric,
  ADD COLUMN IF NOT EXISTS on_sale boolean NOT NULL DEFAULT false;