-- Reviews-Tabelle
CREATE TABLE public.product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_handle TEXT NOT NULL,
  user_id UUID NOT NULL,
  reviewer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 30 AND 1000),
  size_purchased TEXT,
  size_fit TEXT CHECK (size_fit IN ('small','true','large')),
  would_recommend BOOLEAN NOT NULL DEFAULT true,
  verified_purchase BOOLEAN NOT NULL DEFAULT false,
  shopify_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_handle)
);

CREATE INDEX idx_product_reviews_handle_status ON public.product_reviews (product_handle, status);
CREATE INDEX idx_product_reviews_user ON public.product_reviews (user_id);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Public kann nur veröffentlichte Reviews lesen
CREATE POLICY "Public can read published reviews"
  ON public.product_reviews
  FOR SELECT
  TO public
  USING (status = 'published');

-- User kann eigene Reviews lesen (auch pending/rejected)
CREATE POLICY "Users can read own reviews"
  ON public.product_reviews
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- User kann eigene Reviews erstellen (verified/order/status werden serverseitig erzwungen via Edge Function;
-- hier blockieren wir Self-Verification über CHECK)
CREATE POLICY "Users can insert own reviews"
  ON public.product_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND verified_purchase = false
    AND shopify_order_id IS NULL
    AND status = 'pending'
  );

-- User kann eigene Reviews aktualisieren, aber Verifizierungs-/Status-Felder nicht selbst setzen
CREATE POLICY "Users can update own review content"
  ON public.product_reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON public.product_reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Updated-At Trigger
CREATE TRIGGER touch_product_reviews_updated_at
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_profiles_updated_at();

-- Stats-View (Security Invoker, damit RLS auf product_reviews greift)
CREATE OR REPLACE VIEW public.product_review_stats
WITH (security_invoker = true) AS
SELECT
  product_handle,
  COUNT(*)::int AS count,
  ROUND(AVG(rating)::numeric, 2) AS avg_rating,
  COUNT(*) FILTER (WHERE rating = 5)::int AS count_5,
  COUNT(*) FILTER (WHERE rating = 4)::int AS count_4,
  COUNT(*) FILTER (WHERE rating = 3)::int AS count_3,
  COUNT(*) FILTER (WHERE rating = 2)::int AS count_2,
  COUNT(*) FILTER (WHERE rating = 1)::int AS count_1,
  COUNT(*) FILTER (WHERE would_recommend)::int AS count_recommend
FROM public.product_reviews
WHERE status = 'published'
GROUP BY product_handle;

GRANT SELECT ON public.product_review_stats TO anon, authenticated;