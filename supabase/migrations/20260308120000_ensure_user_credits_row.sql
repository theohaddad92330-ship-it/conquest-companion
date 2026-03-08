-- Garantit qu'un utilisateur a toujours une ligne user_credits avant check_and_increment.
-- Corrige le cas : utilisateur créé avant le trigger ou trigger non exécuté.
CREATE OR REPLACE FUNCTION public.check_and_increment_accounts_used(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Créer la ligne si elle n'existe pas (idempotent)
  INSERT INTO public.user_credits (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT accounts_used, accounts_limit
  INTO v_used, v_limit
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_used IS NULL OR v_limit IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE public.user_credits
  SET accounts_used = accounts_used + 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
