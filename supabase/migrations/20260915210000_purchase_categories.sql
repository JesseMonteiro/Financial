-- User-owned purchase categories used to classify manual expenses.

CREATE TABLE IF NOT EXISTS public.purchase_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "key" text NOT NULL,
  label text NOT NULL,
  color text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_categories_user_id_key_key UNIQUE (user_id, "key")
);

ALTER TABLE public.purchase_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'purchase_categories'
      AND policyname = 'Users can manage own purchase categories'
  ) THEN
    CREATE POLICY "Users can manage own purchase categories"
      ON public.purchase_categories FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_categories TO authenticated;

COMMENT ON TABLE public.purchase_categories IS
  'User-defined purchase categories. key is the stable id stored on manual_transactions.category.';
COMMENT ON COLUMN public.purchase_categories."key" IS
  'Stable assignment id (e.g. Food). Immutable after insert.';
COMMENT ON COLUMN public.purchase_categories.label IS
  'Display name shown in pickers (e.g. Alimentação).';
