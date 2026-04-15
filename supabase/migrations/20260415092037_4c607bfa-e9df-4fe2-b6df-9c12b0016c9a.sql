CREATE TABLE public.scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read scenarios"
  ON public.scenarios
  FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.scenarios (name, description, config) VALUES
  ('BAU', 'Business As Usual — current policy trajectory', '{}'),
  ('BWS-1', 'Best Worst Scenario 1 — moderate intervention', '{}'),
  ('BWS-2', 'Best Worst Scenario 2 — aggressive policy', '{}'),
  ('BEST', 'Best case — maximum policy support + technology optimism', '{}');