-- Add archived_at to accounts (null = visible, set = archived)
ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_archived_at ON public.accounts(archived_at) WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN public.accounts.archived_at IS 'When set, account is archived and hidden from default list.';
