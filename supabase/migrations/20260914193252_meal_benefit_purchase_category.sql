-- Optional budget category on VA/VR purchases (defaults applied in app by kind).

ALTER TABLE public.meal_benefit_purchases
  ADD COLUMN IF NOT EXISTS category text;

COMMENT ON COLUMN public.meal_benefit_purchases.category IS
  'PT budget category label. Null uses kind default: VA → supermercado, VR → restaurantes.';
