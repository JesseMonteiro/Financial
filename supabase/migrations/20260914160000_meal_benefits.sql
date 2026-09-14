-- VA/VR (vale alimentação / vale refeição) programs + purchase ledger

CREATE TABLE IF NOT EXISTS public.meal_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('VA', 'VR')),
  label text NOT NULL DEFAULT '',
  monthly_amount numeric NOT NULL DEFAULT 0,
  credit_day integer NOT NULL CHECK (credit_day >= 1 AND credit_day <= 31),
  starts_on date NOT NULL DEFAULT (CURRENT_DATE),
  opening_balance numeric NOT NULL DEFAULT 0,
  show_in_moment boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_benefits_user_id_idx ON public.meal_benefits (user_id);

CREATE TABLE IF NOT EXISTS public.meal_benefit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  benefit_id uuid NOT NULL REFERENCES public.meal_benefits(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount >= 0),
  purchased_at date NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_benefit_purchases_user_id_idx ON public.meal_benefit_purchases (user_id);
CREATE INDEX IF NOT EXISTS meal_benefit_purchases_benefit_id_idx ON public.meal_benefit_purchases (benefit_id);
CREATE INDEX IF NOT EXISTS meal_benefit_purchases_purchased_at_idx ON public.meal_benefit_purchases (purchased_at);

ALTER TABLE public.meal_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_benefit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own or joint meal_benefits"
  ON public.meal_benefits FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.are_joint_partners(auth.uid(), user_id)
  );

CREATE POLICY "Users can insert own meal_benefits"
  ON public.meal_benefits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal_benefits"
  ON public.meal_benefits FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal_benefits"
  ON public.meal_benefits FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can select own or joint meal_benefit_purchases"
  ON public.meal_benefit_purchases FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.are_joint_partners(auth.uid(), user_id)
  );

CREATE POLICY "Users can insert own meal_benefit_purchases"
  ON public.meal_benefit_purchases FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.meal_benefits b
      WHERE b.id = benefit_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own meal_benefit_purchases"
  ON public.meal_benefit_purchases FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.meal_benefits b
      WHERE b.id = benefit_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own meal_benefit_purchases"
  ON public.meal_benefit_purchases FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_benefits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_benefit_purchases TO authenticated;

COMMENT ON TABLE public.meal_benefits IS
  'User-programmed VA/VR benefits: monthly credit, credit day, and remaining balance tracking';
COMMENT ON TABLE public.meal_benefit_purchases IS
  'Purchases that debit a meal benefit balance; cascade-deleted with the parent benefit';
