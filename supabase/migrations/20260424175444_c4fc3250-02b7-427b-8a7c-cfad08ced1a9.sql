CREATE TABLE public.product_price_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text NOT NULL UNIQUE,
  brand text NOT NULL,
  source_url text,
  raw_price_eur numeric,
  display_price_chf numeric NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read product price cache"
ON public.product_price_cache FOR SELECT
USING (true);

CREATE INDEX idx_product_price_cache_handle ON public.product_price_cache(handle);