
CREATE TABLE public.look_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  look_slug text NOT NULL,
  ip_hash text NOT NULL,
  user_id uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (look_slug, ip_hash)
);

CREATE INDEX idx_look_likes_slug ON public.look_likes(look_slug);

ALTER TABLE public.look_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read look likes"
  ON public.look_likes
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.get_look_like_count(_slug text)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*), 0)::int
  FROM public.look_likes
  WHERE look_slug = _slug;
$$;
