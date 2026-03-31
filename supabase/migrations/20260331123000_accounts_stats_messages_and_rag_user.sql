-- =========================================================
-- Bellum — Robustness & scalability baseline (2026-03-31)
-- - Separate message-generation state from analysis state
-- - Add account stats columns to avoid N+1 / heavy joins in frontend
-- - Make rag_documents ownership explicit (per-user) while keeping legacy rows readable
-- =========================================================

-- -------------------------------
-- ACCOUNTS: stats + messages meta
-- -------------------------------
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS contact_count INTEGER NOT NULL DEFAULT 0 CHECK (contact_count >= 0),
ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
ADD COLUMN IF NOT EXISTS messages_last_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS messages_last_generated_count INTEGER NOT NULL DEFAULT 0 CHECK (messages_last_generated_count >= 0),
ADD COLUMN IF NOT EXISTS messages_last_generated_trace JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_accounts_contact_count ON public.accounts(contact_count);
CREATE INDEX IF NOT EXISTS idx_accounts_message_count ON public.accounts(message_count);

-- Backfill stats for existing rows
UPDATE public.accounts a
SET
  contact_count = COALESCE(x.contact_count, 0),
  message_count = COALESCE(x.message_count, 0)
FROM (
  SELECT
    c.account_id,
    COUNT(*)::int AS contact_count,
    SUM(
      (CASE WHEN (c.email_message->>'body') IS NOT NULL AND (c.email_message->>'body') <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN c.linkedin_message IS NOT NULL AND c.linkedin_message <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN (c.followup_message->>'body') IS NOT NULL AND (c.followup_message->>'body') <> '' THEN 1 ELSE 0 END)
    )::int AS message_count
  FROM public.contacts c
  GROUP BY c.account_id
) x
WHERE a.id = x.account_id;

-- Trigger function to keep stats consistent
CREATE OR REPLACE FUNCTION public.recompute_account_stats(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_count int;
  v_message_count int;
BEGIN
  SELECT
    COUNT(*)::int,
    COALESCE(SUM(
      (CASE WHEN (email_message->>'body') IS NOT NULL AND (email_message->>'body') <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN linkedin_message IS NOT NULL AND linkedin_message <> '' THEN 1 ELSE 0 END) +
      (CASE WHEN (followup_message->>'body') IS NOT NULL AND (followup_message->>'body') <> '' THEN 1 ELSE 0 END)
    ), 0)::int
  INTO v_contact_count, v_message_count
  FROM public.contacts
  WHERE account_id = p_account_id;

  UPDATE public.accounts
  SET contact_count = COALESCE(v_contact_count, 0),
      message_count = COALESCE(v_message_count, 0),
      updated_at = now()
  WHERE id = p_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_contacts_changed_recompute_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- handle INSERT/UPDATE/DELETE
  PERFORM public.recompute_account_stats(COALESCE(NEW.account_id, OLD.account_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_recompute_account_stats ON public.contacts;
CREATE TRIGGER trg_contacts_recompute_account_stats
AFTER INSERT OR UPDATE OR DELETE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.on_contacts_changed_recompute_stats();


-- -------------------------------
-- RAG_DOCUMENTS: per-user ownership
-- -------------------------------
ALTER TABLE public.rag_documents
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rag_documents_user_id ON public.rag_documents(user_id);

-- Ensure RLS is enabled (already done in prior migration, keep idempotent)
ALTER TABLE public.rag_documents ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive policies if they exist
DROP POLICY IF EXISTS "Authenticated users can insert rag_documents" ON public.rag_documents;
DROP POLICY IF EXISTS "Authenticated users can update rag_documents" ON public.rag_documents;
DROP POLICY IF EXISTS "Authenticated users can delete rag_documents" ON public.rag_documents;

-- Read: allow authenticated to read their own docs + legacy docs without owner (user_id IS NULL)
DROP POLICY IF EXISTS "Authenticated users can read rag_documents" ON public.rag_documents;
CREATE POLICY "Authenticated users can read rag_documents"
  ON public.rag_documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Write: only on own docs
CREATE POLICY "Users can insert own rag_documents"
  ON public.rag_documents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own rag_documents"
  ON public.rag_documents FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own rag_documents"
  ON public.rag_documents FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

