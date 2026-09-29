-- Migration: Pluggy Sync Cache & Webhooks
-- Tables to cache Pluggy accounts, transactions, and track sync freshness per user.

-- 1. Table: pluggy_sync_items
CREATE TABLE IF NOT EXISTS public.pluggy_sync_items (
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pluggy_item_id    text NOT NULL,
  connector_name    text,
  status            text DEFAULT 'PENDING',
  execution_status  text,
  error_message     text,
  last_synced_at    timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, pluggy_item_id)
);

ALTER TABLE public.pluggy_sync_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own sync items" ON public.pluggy_sync_items;
CREATE POLICY "Users can read own sync items"
  ON public.pluggy_sync_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on sync items" ON public.pluggy_sync_items;
CREATE POLICY "Service role full access on sync items"
  ON public.pluggy_sync_items FOR ALL
  USING (auth.role() = 'service_role' OR auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pluggy_sync_items_user_synced
  ON public.pluggy_sync_items(user_id, last_synced_at DESC);


-- 2. Table: cached_accounts
CREATE TABLE IF NOT EXISTS public.cached_accounts (
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pluggy_account_id text NOT NULL,
  pluggy_item_id    text NOT NULL,
  name              text,
  type              text,
  subtype           text,
  balance           numeric,
  currency_code     text DEFAULT 'BRL',
  data              jsonb NOT NULL,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, pluggy_account_id)
);

ALTER TABLE public.cached_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own cached accounts" ON public.cached_accounts;
CREATE POLICY "Users can read own cached accounts"
  ON public.cached_accounts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on cached accounts" ON public.cached_accounts;
CREATE POLICY "Service role full access on cached accounts"
  ON public.cached_accounts FOR ALL
  USING (auth.role() = 'service_role' OR auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cached_accounts_item
  ON public.cached_accounts(user_id, pluggy_item_id);


-- 3. Table: cached_transactions
CREATE TABLE IF NOT EXISTS public.cached_transactions (
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pluggy_transaction_id  text NOT NULL,
  account_id            text NOT NULL,
  date                  date NOT NULL,
  amount                numeric NOT NULL,
  type                  text,
  category              text,
  category_id           text,
  description           text,
  status                text,
  data                  jsonb NOT NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, pluggy_transaction_id)
);

ALTER TABLE public.cached_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own cached transactions" ON public.cached_transactions;
CREATE POLICY "Users can read own cached transactions"
  ON public.cached_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on cached transactions" ON public.cached_transactions;
CREATE POLICY "Service role full access on cached transactions"
  ON public.cached_transactions FOR ALL
  USING (auth.role() = 'service_role' OR auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cached_tx_account_date
  ON public.cached_transactions(user_id, account_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_cached_tx_date
  ON public.cached_transactions(user_id, date DESC);


-- 4. Table: pluggy_webhook_events (Idempotency and tracing)
CREATE TABLE IF NOT EXISTS public.pluggy_webhook_events (
  event_id    text PRIMARY KEY,
  event_type  text NOT NULL,
  item_id     text,
  payload     jsonb,
  received_at timestamptz DEFAULT now(),
  processed   boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received
  ON public.pluggy_webhook_events(received_at DESC);
