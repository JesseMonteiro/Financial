-- Joint account linking: two users share a consolidated Financial Moment view.

CREATE TABLE IF NOT EXISTS public.joint_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked')),
  invite_token text,
  invite_expires_at timestamptz,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT joint_links_distinct_users CHECK (user_b IS NULL OR user_a <> user_b)
);

CREATE INDEX IF NOT EXISTS joint_links_user_a_idx ON public.joint_links (user_a);
CREATE INDEX IF NOT EXISTS joint_links_user_b_idx ON public.joint_links (user_b);
CREATE INDEX IF NOT EXISTS joint_links_invite_token_idx ON public.joint_links (invite_token)
  WHERE invite_token IS NOT NULL;

-- At most one pending/active link involving a given user as user_a or user_b.
CREATE UNIQUE INDEX IF NOT EXISTS joint_links_one_open_a
  ON public.joint_links (user_a)
  WHERE status IN ('pending', 'active');

CREATE UNIQUE INDEX IF NOT EXISTS joint_links_one_open_b
  ON public.joint_links (user_b)
  WHERE status IN ('pending', 'active') AND user_b IS NOT NULL;

ALTER TABLE public.joint_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own joint links"
  ON public.joint_links FOR SELECT
  USING (auth.uid() = user_a OR auth.uid() = user_b OR auth.uid() = invited_by);

-- Helper: true if two users share an active joint link
CREATE OR REPLACE FUNCTION public.are_joint_partners(p_user_a uuid, p_user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.joint_links jl
    WHERE jl.status = 'active'
      AND (
        (jl.user_a = p_user_a AND jl.user_b = p_user_b)
        OR (jl.user_a = p_user_b AND jl.user_b = p_user_a)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_joint_partner_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN jl.user_a = p_user_id THEN jl.user_b
    ELSE jl.user_a
  END
  FROM public.joint_links jl
  WHERE jl.status = 'active'
    AND (jl.user_a = p_user_id OR jl.user_b = p_user_id)
  LIMIT 1;
$$;

-- Generate / refresh invite code (6 digits, 30 min)
CREATE OR REPLACE FUNCTION public.generate_joint_invite_token(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_existing uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Already actively linked?
  IF public.get_joint_partner_id(p_user_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Already linked to a joint account';
  END IF;

  -- Already the acceptor on a pending/active link?
  SELECT id INTO v_existing
  FROM public.joint_links
  WHERE user_b = p_user_id AND status IN ('pending', 'active')
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Already part of a joint invite';
  END IF;

  v_token := lpad(floor(random() * 1000000)::text, 6, '0');

  UPDATE public.joint_links
  SET
    invite_token = v_token,
    invite_expires_at = now() + interval '30 minutes',
    updated_at = now()
  WHERE user_a = p_user_id
    AND status = 'pending'
    AND user_b IS NULL;

  IF NOT FOUND THEN
    -- Revoke any stale pending as inviter first
    UPDATE public.joint_links
    SET status = 'revoked', updated_at = now()
    WHERE user_a = p_user_id AND status = 'pending';

    INSERT INTO public.joint_links (user_a, status, invite_token, invite_expires_at, invited_by)
    VALUES (p_user_id, 'pending', v_token, now() + interval '30 minutes', p_user_id);
  END IF;

  RETURN v_token;
END;
$$;

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

  -- Acceptor already linked (as user_a or user_b on any active link)
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

  -- Inviter must still be free (not already active as partner elsewhere)
  IF public.get_joint_partner_id(v_row.user_a) IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quem gerou o convite já está vinculado a outra conta');
  END IF;

  -- Drop any pending invites the acceptor created as user_a (prevents dual open links)
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

CREATE OR REPLACE FUNCTION public.get_my_joint_link()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.joint_links%ROWTYPE;
  v_partner_id uuid;
  v_partner_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.joint_links
  WHERE status IN ('pending', 'active')
    AND (user_a = v_uid OR user_b = v_uid)
  ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.status = 'active' THEN
    v_partner_id := CASE WHEN v_row.user_a = v_uid THEN v_row.user_b ELSE v_row.user_a END;
    SELECT display_name INTO v_partner_name FROM public.profiles WHERE id = v_partner_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'user_a', v_row.user_a,
    'user_b', v_row.user_b,
    'invited_by', v_row.invited_by,
    'invite_token', CASE WHEN v_row.user_a = v_uid AND v_row.status = 'pending' THEN v_row.invite_token ELSE NULL END,
    'invite_expires_at', v_row.invite_expires_at,
    'partner_id', v_partner_id,
    'partner_display_name', v_partner_name,
    'created_at', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unlink_joint_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;

  UPDATE public.joint_links
  SET status = 'revoked', invite_token = NULL, invite_expires_at = NULL, updated_at = now()
  WHERE status IN ('pending', 'active')
    AND (user_a = v_uid OR user_b = v_uid);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nenhum vínculo encontrado');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_linked_monthly_salaries(p_target_user_id uuid, p_salaries jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Não autenticado');
  END IF;

  IF v_uid IS DISTINCT FROM p_target_user_id
     AND NOT public.are_joint_partners(v_uid, p_target_user_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Sem permissão para editar este salário');
  END IF;

  UPDATE public.profiles
  SET monthly_salaries = COALESCE(p_salaries, '{}'::jsonb),
      updated_at = now()
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Perfil não encontrado');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Shared SELECT of partner display_name + salaries for joint moment
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
        'monthly_salaries', COALESCE(p.monthly_salaries, '{}'::jsonb)
      ))
      FROM public.profiles p
      WHERE p.id = v_uid
    );
  END IF;

  RETURN (
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'monthly_salaries', COALESCE(p.monthly_salaries, '{}'::jsonb)
    ) ORDER BY CASE WHEN p.id = v_uid THEN 0 ELSE 1 END)
    FROM public.profiles p
    WHERE p.id IN (v_uid, v_partner)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_joint_invite_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_joint_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_joint_link() TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_joint_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_linked_monthly_salaries(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_joint_member_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_joint_partners(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_joint_partner_id(uuid) TO authenticated;

-- Replace ALL policies on manual_transactions with granular ones
DROP POLICY IF EXISTS "Users can manage own manual_transactions" ON public.manual_transactions;

CREATE POLICY "Users can select own or joint manual_transactions"
  ON public.manual_transactions FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.are_joint_partners(auth.uid(), user_id)
  );

CREATE POLICY "Users can insert own manual_transactions"
  ON public.manual_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or joint manual_transactions"
  ON public.manual_transactions FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.are_joint_partners(auth.uid(), user_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.are_joint_partners(auth.uid(), user_id)
  );

CREATE POLICY "Users can delete own manual_transactions"
  ON public.manual_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Replace ALL policies on receivables
DROP POLICY IF EXISTS "Users can manage own receivables" ON public.receivables;

CREATE POLICY "Users can select own or joint receivables"
  ON public.receivables FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.are_joint_partners(auth.uid(), user_id)
  );

CREATE POLICY "Users can insert own receivables"
  ON public.receivables FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own or joint receivables"
  ON public.receivables FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.are_joint_partners(auth.uid(), user_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.are_joint_partners(auth.uid(), user_id)
  );

CREATE POLICY "Users can delete own receivables"
  ON public.receivables FOR DELETE
  USING (auth.uid() = user_id);
