-- Bellum AI core tables (accounts, contacts, angles, plans, credits)

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  
  -- Données enrichies (remplies par l'API)
  sector TEXT,
  employees TEXT,
  revenue TEXT,
  headquarters TEXT,
  website TEXT,
  subsidiaries JSONB DEFAULT '[]'::jsonb,
  it_challenges JSONB DEFAULT '[]'::jsonb,
  recent_signals JSONB DEFAULT '[]'::jsonb,
  priority_score INTEGER DEFAULT 0,
  priority_justification TEXT,
  
  -- Analyse complète brute (stocke toute la réponse LLM)
  raw_analysis JSONB,
  
  -- Métadonnées
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'error')),
  error_message TEXT,
  user_context TEXT,
  
  -- Coûts
  api_cost_euros NUMERIC(10,4) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_accounts_status ON public.accounts(status);
CREATE INDEX idx_accounts_created_at ON public.accounts(created_at DESC);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own accounts" ON public.accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own accounts" ON public.accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own accounts" ON public.accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own accounts" ON public.accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  full_name TEXT NOT NULL,
  title TEXT,
  entity TEXT,
  decision_role TEXT CHECK (decision_role IN ('sponsor', 'champion', 'operational', 'purchasing', 'blocker', 'influencer', 'unknown')),
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  
  email TEXT,
  email_verified BOOLEAN DEFAULT false,
  phone TEXT,
  linkedin_url TEXT,
  
  profile_summary TEXT,
  why_contact TEXT,
  
  email_message JSONB,
  linkedin_message TEXT,
  phone_script TEXT,
  followup_message JSONB,
  
  user_status TEXT DEFAULT 'new' CHECK (user_status IN ('new', 'contacted', 'replied', 'meeting', 'refused', 'silence')),
  
  source TEXT DEFAULT 'linkedin',
  raw_data JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_account_id ON public.contacts(account_id);
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_priority ON public.contacts(priority);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own contacts" ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own contacts" ON public.contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own contacts" ON public.contacts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.attack_angles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT,
  entry_point TEXT,
  is_recommended BOOLEAN DEFAULT false,
  rank INTEGER DEFAULT 1,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.attack_angles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own angles" ON public.attack_angles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own angles" ON public.attack_angles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own angles" ON public.attack_angles FOR DELETE USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  strategy_type TEXT,
  strategy_justification TEXT,
  
  weeks JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own plans" ON public.action_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own plans" ON public.action_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own plans" ON public.action_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own plans" ON public.action_plans FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_action_plans_updated_at
BEFORE UPDATE ON public.action_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.user_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'scale')),
  accounts_used INTEGER NOT NULL DEFAULT 0,
  accounts_limit INTEGER NOT NULL DEFAULT 3,
  contacts_enriched INTEGER NOT NULL DEFAULT 0,
  contacts_limit INTEGER NOT NULL DEFAULT 50,
  
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own credits" ON public.user_credits FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credits (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_credits
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

CREATE TRIGGER update_user_credits_updated_at
BEFORE UPDATE ON public.user_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE OR REPLACE FUNCTION public.increment_accounts_used(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_credits
  SET accounts_used = accounts_used + 1
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

