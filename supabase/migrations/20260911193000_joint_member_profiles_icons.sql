-- Joint moment needs partner item ids + uploaded card faces without service role.
-- Profiles RLS only allows SELECT of the caller's own row; this SECURITY DEFINER
-- RPC already returns partner display_name/salaries for the linked pair.

CREATE OR REPLACE FUNCTION public.get_joint_member_profiles()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_partner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_partner := public.get_joint_partner_id(v_uid);
  IF v_partner IS NULL THEN
    RETURN (
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'monthly_salaries', COALESCE(p.monthly_salaries, '{}'::jsonb),
        'custom_account_names', COALESCE(p.custom_account_names, '{}'::jsonb),
        'custom_account_icons', COALESCE(p.custom_account_icons, '{}'::jsonb),
        'pluggy_item_ids', COALESCE(p.pluggy_item_ids, '[]'::jsonb)
      ))
      FROM public.profiles p
      WHERE p.id = v_uid
    );
  END IF;

  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'monthly_salaries', COALESCE(p.monthly_salaries, '{}'::jsonb),
      'custom_account_names', COALESCE(p.custom_account_names, '{}'::jsonb),
      'custom_account_icons', COALESCE(p.custom_account_icons, '{}'::jsonb),
      'pluggy_item_ids', COALESCE(p.pluggy_item_ids, '[]'::jsonb)
    ) ORDER BY CASE WHEN p.id = v_uid THEN 0 ELSE 1 END)
    FROM public.profiles p
    WHERE p.id IN (v_uid, v_partner)
  );
END;
$$;
