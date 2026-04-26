-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  birthday date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Points ledger
CREATE TABLE public.club_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_club_points_user_created
  ON public.club_points_ledger (user_id, created_at DESC);

ALTER TABLE public.club_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own points"
  ON public.club_points_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.touch_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_touch
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_profiles_updated_at();

-- get_my_points: returns total points for current user
CREATE OR REPLACE FUNCTION public.get_my_points()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::int
  FROM public.club_points_ledger
  WHERE user_id = auth.uid();
$$;

-- add_club_points: only callable for self (or service role)
CREATE OR REPLACE FUNCTION public.add_club_points(
  _points integer,
  _reason text,
  _meta jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _points = 0 THEN
    RAISE EXCEPTION 'Points must be non-zero';
  END IF;
  -- Demo-mode: limit single grant size to prevent abuse
  IF _points > 500 THEN
    RAISE EXCEPTION 'Single grant too large';
  END IF;

  INSERT INTO public.club_points_ledger (user_id, points, reason, meta)
  VALUES (_uid, _points, COALESCE(_reason, 'manual'), COALESCE(_meta, '{}'::jsonb));

  RETURN public.get_my_points();
END;
$$;

-- Auto-create profile + welcome bonus on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.club_points_ledger (user_id, points, reason)
  VALUES (NEW.id, 100, 'welcome_bonus');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();