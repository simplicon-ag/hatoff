CREATE TABLE public.curated_looks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  welt text,
  anlaesse text[] NOT NULL DEFAULT '{}',
  product_handles text[] NOT NULL DEFAULT '{}',
  anchor_handle text,
  story text,
  highlights text[] NOT NULL DEFAULT '{}',
  hero_image_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX curated_looks_status_idx ON public.curated_looks(status);
CREATE INDEX curated_looks_anchor_idx ON public.curated_looks(anchor_handle);
CREATE INDEX curated_looks_handles_gin ON public.curated_looks USING GIN(product_handles);

ALTER TABLE public.curated_looks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published looks"
  ON public.curated_looks
  FOR SELECT
  USING (status = 'published');

-- Storage bucket for hero images
INSERT INTO storage.buckets (id, name, public)
VALUES ('look-heroes', 'look-heroes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read look heroes"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'look-heroes');

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_curated_looks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER curated_looks_touch
BEFORE UPDATE ON public.curated_looks
FOR EACH ROW EXECUTE FUNCTION public.touch_curated_looks_updated_at();