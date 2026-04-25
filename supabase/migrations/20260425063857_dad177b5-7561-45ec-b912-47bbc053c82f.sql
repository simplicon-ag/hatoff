-- Cache table mapping product handles to a season per brand
CREATE TABLE public.brand_season_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  season TEXT NOT NULL, -- e.g. 'fs-2026', 'hw-2026'
  handle TEXT NOT NULL,
  source_url TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (brand, season, handle)
);

CREATE INDEX idx_brand_season_products_season ON public.brand_season_products (season);
CREATE INDEX idx_brand_season_products_brand_season ON public.brand_season_products (brand, season);

ALTER TABLE public.brand_season_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read brand season products"
  ON public.brand_season_products
  FOR SELECT
  USING (true);