// ============================================
// Types Bellum AI — correspondance exacte avec les tables Supabase
// ============================================

export interface AccountAnalysis {
  id: string;
  user_id: string;
  company_name: string;
  sector: string | null;
  employees: string | null;
  revenue: string | null;
  headquarters: string | null;
  website: string | null;
  subsidiaries: string[];
  it_challenges: string[];
  recent_signals: string[];
  priority_score: number;
  priority_justification: string | null;
  raw_analysis: any;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  error_message: string | null;
  user_context: string | null;
  api_cost_euros: number;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  account_id: string;
  user_id: string;
  full_name: string;
  title: string | null;
  entity: string | null;
  decision_role: 'sponsor' | 'champion' | 'operational' | 'purchasing' | 'blocker' | 'influencer' | 'unknown';
  priority: number;
  email: string | null;
  email_verified: boolean;
  phone: string | null;
  linkedin_url: string | null;
  profile_summary: string | null;
  why_contact: string | null;
  email_message: { subject: string; body: string } | null;
  linkedin_message: string | null;
  phone_script: string | null;
  followup_message: { subject: string; body: string } | null;
  user_status: 'new' | 'contacted' | 'replied' | 'meeting' | 'refused' | 'silence';
  source: string;
  raw_data: any;
  created_at: string;
  updated_at: string;
}

export interface AttackAngle {
  id: string;
  account_id: string;
  user_id: string;
  title: string;
  description: string | null;
  entry_point: string | null;
  is_recommended: boolean;
  rank: number;
  created_at: string;
}

export interface ActionPlan {
  id: string;
  account_id: string;
  user_id: string;
  strategy_type: string | null;
  strategy_justification: string | null;
  weeks: ActionWeek[];
  created_at: string;
  updated_at: string;
}

export interface ActionWeek {
  week: number;
  title: string;
  items: { text: string; done: boolean }[];
}

export interface UserCredits {
  id: string;
  user_id: string;
  plan: 'free' | 'starter' | 'pro' | 'scale';
  accounts_used: number;
  accounts_limit: number;
  contacts_enriched: number;
  contacts_limit: number;
  period_start: string;
  period_end: string;
}

// État de l'analyse progressive (utilisé par Search.tsx)
export interface AnalysisState {
  status: 'idle' | 'loading' | 'analyzing' | 'completed' | 'error';
  accountId: string | null;
  account: AccountAnalysis | null;
  contacts: Contact[];
  angles: AttackAngle[];
  actionPlan: ActionPlan | null;
  progress: number;
  currentStep: string;
  error: string | null;
}
