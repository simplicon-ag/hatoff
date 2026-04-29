CREATE TABLE IF NOT EXISTS public.sweep_state (
  id text PRIMARY KEY,
  offset_value integer NOT NULL DEFAULT 0,
  total_value integer NOT NULL DEFAULT 0,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.sweep_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read sweep state"
  ON public.sweep_state FOR SELECT
  USING (true);
