-- Harden accept_joint_invite against dual open links; lock manual_transactions.user_id on update.

CREATE OR REPLACE FUNCTION public.accept_joint_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.joint_links%ROWTYPE;
  v_partner_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;

  IF public.get_joint_partner_id(v_uid) IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Você já possui uma conta conjunta ativa');
  END IF;

  SELECT * INTO v_row
  FROM public.joint_links
  WHERE invite_token = p_token
    AND status = 'pending'
    AND user_b IS NULL
    AND invite_expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Código inválido ou expirado');
  END IF;

  IF v_row.user_a = v_uid THEN
    RETURN jsonb_build_object('success', false, 'message', 'Você não pode aceitar o próprio convite');
  END IF;

  IF public.get_joint_partner_id(v_row.user_a) IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quem gerou o convite já está vinculado a outra conta');
  END IF;

  UPDATE public.joint_links
  SET status = 'revoked', invite_token = NULL, invite_expires_at = NULL, updated_at = now()
  WHERE user_a = v_uid AND status = 'pending';

  UPDATE public.joint_links
  SET
    user_b = v_uid,
    status = 'active',
    invite_token = NULL,
    invite_expires_at = NULL,
    updated_at = now()
  WHERE id = v_row.id
    AND status = 'pending'
    AND user_b IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Convite já foi usado ou cancelado');
  END IF;

  SELECT display_name INTO v_partner_name FROM public.profiles WHERE id = v_row.user_a;

  RETURN jsonb_build_object(
    'success', true,
    'link_id', v_row.id,
    'partner_id', v_row.user_a,
    'partner_display_name', COALESCE(v_partner_name, 'Parceiro')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_manual_tx_owner_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change manual_transactions.user_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_manual_tx_owner_change ON public.manual_transactions;
CREATE TRIGGER trg_prevent_manual_tx_owner_change
  BEFORE UPDATE ON public.manual_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_manual_tx_owner_change();
