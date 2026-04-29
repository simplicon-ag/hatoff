CREATE TABLE public.product_color_group (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_article_id TEXT NOT NULL,
  brand TEXT NOT NULL,
  color TEXT NOT NULL,
  shopify_handle TEXT NOT NULL,
  shopify_product_id TEXT,
  source_url TEXT,
  swatch_image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_article_id, color),
  UNIQUE (shopify_handle)
);

CREATE INDEX idx_pcg_parent ON public.product_color_group (parent_article_id);
CREATE INDEX idx_pcg_handle ON public.product_color_group (shopify_handle);
CREATE INDEX idx_pcg_brand ON public.product_color_group (brand);

ALTER TABLE public.product_color_group ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read product color groups"
  ON public.product_color_group
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.touch_pcg_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_pcg_updated_at
  BEFORE UPDATE ON public.product_color_group
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_pcg_updated_at();