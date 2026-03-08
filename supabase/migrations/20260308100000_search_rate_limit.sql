-- Rate limit for search-companies Edge Function (per user, per 15 min)
CREATE TABLE IF NOT EXISTS public.rate_limit_search (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_search_user_created
  ON public.rate_limit_search (user_id, created_at DESC);

ALTER TABLE public.rate_limit_search ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/select (Edge Function uses service role)
CREATE POLICY "Service role can manage rate_limit_search"
  ON public.rate_limit_search FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Returns true if under limit (and records the call), false if over limit
CREATE OR REPLACE FUNCTION public.check_and_record_search_rate_limit(
  p_user_id UUID,
  p_max_per_15min INTEGER DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.rate_limit_search
  WHERE created_at < now() - interval '15 minutes';

  SELECT COUNT(*) INTO v_count
  FROM public.rate_limit_search
  WHERE user_id = p_user_id
    AND created_at > now() - interval '15 minutes';

  IF v_count >= p_max_per_15min THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.rate_limit_search (user_id) VALUES (p_user_id);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
