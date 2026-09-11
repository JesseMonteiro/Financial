-- Manual accounts/cards + link manual_transactions to an account

CREATE TABLE IF NOT EXISTS public.manual_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('BANK', 'CREDIT')),
  name text NOT NULL,
  institution_name text,
  number text,
  balance numeric NOT NULL DEFAULT 0,
  bill_amount numeric,
  bill_due_day integer CHECK (bill_due_day IS NULL OR (bill_due_day >= 1 AND bill_due_day <= 31)),
  credit_limit numeric,
  pair_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_accounts_user_id_idx ON public.manual_accounts (user_id);
CREATE INDEX IF NOT EXISTS manual_accounts_pair_id_idx ON public.manual_accounts (pair_id)
  WHERE pair_id IS NOT NULL;

ALTER TABLE public.manual_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own or joint manual_accounts"
  ON public.manual_accounts FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.are_joint_partners(auth.uid(), user_id)
  );

CREATE POLICY "Users can insert own manual_accounts"
  ON public.manual_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own manual_accounts"
  ON public.manual_accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own manual_accounts"
  ON public.manual_accounts FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_accounts TO authenticated;

ALTER TABLE public.manual_transactions
  ADD COLUMN IF NOT EXISTS account_id text;

COMMENT ON TABLE public.manual_accounts IS
  'User-created bank accounts and credit cards not linked to Open Finance';
COMMENT ON COLUMN public.manual_transactions.account_id IS
  'Optional local or Pluggy account id; empty means unassigned (legacy manual)';
