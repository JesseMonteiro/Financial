-- Per-installment paid flag for manual expenses (tracking only)
ALTER TABLE public.manual_transactions
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN public.manual_transactions.is_paid IS
  'User-marked paid flag for this installment/occurrence only; does not move money';
