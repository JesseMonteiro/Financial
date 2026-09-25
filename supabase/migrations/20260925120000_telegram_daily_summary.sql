-- Track the last date a daily summary was sent to the user's Telegram
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_telegram_daily_summary_date text;

COMMENT ON COLUMN public.profiles.last_telegram_daily_summary_date IS
  'Date (YYYY-MM-DD) of the last yesterday summary proactively sent via Telegram';
