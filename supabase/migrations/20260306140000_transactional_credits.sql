-- Fonction transactionnelle : vérifie ET incrémente en une seule opération
-- Retourne true si le crédit a été consommé, false si limite atteinte
CREATE OR REPLACE FUNCTION public.check_and_increment_accounts_used(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
BEGIN
  -- Verrouiller la ligne pour éviter les race conditions
  SELECT accounts_used, accounts_limit
  INTO v_used, v_limit
  FROM public.user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Vérifier la limite
  IF v_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  -- Incrémenter
  UPDATE public.user_credits
  SET accounts_used = accounts_used + 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fonction pour limiter le nombre d'analyses par heure (anti-spam)
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id UUID, p_max_per_hour INTEGER DEFAULT 10)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.accounts
  WHERE user_id = p_user_id
    AND created_at > now() - interval '1 hour';

  RETURN v_count < p_max_per_hour;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
