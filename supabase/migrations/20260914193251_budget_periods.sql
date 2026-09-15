-- Budget category limits: period (daily/weekly/biweekly/monthly).
-- Live `budgets` existed without versioned DDL; this is idempotent.

CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  "limit" numeric NOT NULL,
  period text NOT NULL DEFAULT 'monthly',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budgets_user_id_category_key UNIQUE (user_id, category)
);

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS period text NOT NULL DEFAULT 'monthly';

ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_period_check;
ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_period_check
  CHECK (period IN ('daily', 'weekly', 'biweekly', 'monthly'));

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'budgets'
      AND policyname = 'Users can manage own budgets'
  ) THEN
    CREATE POLICY "Users can manage own budgets"
      ON public.budgets FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;

COMMENT ON COLUMN public.budgets.period IS
  'Tracking cadence: daily, weekly, biweekly, or monthly. limit is the amount per period.';
COMMENT ON COLUMN public.budgets."limit" IS
  'Amount for one period (R$/day, R$/week, R$/fortnight, or R$/month).';
