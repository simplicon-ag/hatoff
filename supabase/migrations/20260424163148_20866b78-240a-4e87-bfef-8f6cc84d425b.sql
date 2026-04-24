CREATE TABLE public.size_guide_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL UNIQUE,
  source_url text NOT NULL,
  content text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.size_guide_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read size guide cache"
  ON public.size_guide_cache
  FOR SELECT
  USING (true);

CREATE INDEX idx_size_guide_cache_brand ON public.size_guide_cache(brand);