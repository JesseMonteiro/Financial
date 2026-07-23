-- Persist Momento Financeiro salaries across devices/sessions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_salaries jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.monthly_salaries IS
  'Map of YYYY-MM -> salary amount, plus optional _default for inheritance';
