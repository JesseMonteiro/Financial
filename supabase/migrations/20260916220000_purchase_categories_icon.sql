-- Allow custom icon id per purchase category (shared catalog id for iOS SF Symbol + web Lucide).

ALTER TABLE public.purchase_categories
  ADD COLUMN IF NOT EXISTS icon text;

COMMENT ON COLUMN public.purchase_categories.icon IS
  'Stable icon id from CategoryIconCatalog (e.g. utensils, car, home).';
