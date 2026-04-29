CREATE TABLE public.size_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_handle text NOT NULL,
  product_title text,
  parent_article_id text,
  brand text,
  color text,
  requested_size text NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  message text,
  user_id uuid,
  status text NOT NULL DEFAULT 'new',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_size_requests_handle ON public.size_requests(product_handle);
CREATE INDEX idx_size_requests_status ON public.size_requests(status);
CREATE INDEX idx_size_requests_created ON public.size_requests(created_at DESC);

ALTER TABLE public.size_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) may submit a request
CREATE POLICY "Anyone can submit size request"
  ON public.size_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'new'
    AND admin_note IS NULL
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- Logged-in users may read their own requests
CREATE POLICY "Users can read own size requests"
  ON public.size_requests
  FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- Auto-update updated_at
CREATE TRIGGER trg_size_requests_touch
BEFORE UPDATE ON public.size_requests
FOR EACH ROW
EXECUTE FUNCTION public.touch_pcg_updated_at();