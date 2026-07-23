-- Expose user-defined account/card labels to the Telegram chatbot profile RPC
CREATE OR REPLACE FUNCTION public.get_profile_by_telegram_chat_id(p_chat_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'display_name', display_name,
    'pluggy_item_ids', pluggy_item_ids,
    'pluggy_client_id', pluggy_client_id,
    'pluggy_client_secret', pluggy_client_secret,
    'custom_account_names', COALESCE(custom_account_names, '{}'::jsonb)
  ) INTO v_result
  FROM public.profiles
  WHERE telegram_chat_id = p_chat_id;

  RETURN v_result;
END;
$function$;
