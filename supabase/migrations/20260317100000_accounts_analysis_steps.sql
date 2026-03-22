-- Add analysis step/progress fields for better UX & debugging

ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS analysis_step TEXT,
ADD COLUMN IF NOT EXISTS analysis_progress INTEGER DEFAULT 0 CHECK (analysis_progress BETWEEN 0 AND 100),
ADD COLUMN IF NOT EXISTS analysis_trace JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_accounts_analysis_step ON public.accounts(analysis_step);

