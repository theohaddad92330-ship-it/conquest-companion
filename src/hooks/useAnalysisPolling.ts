import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnalysisState, AccountAnalysis, Contact, AttackAngle, ActionPlan } from '@/types/account';
import { useQueryClient } from '@tanstack/react-query';
import { analyzeAccountSchema } from '@/lib/validation';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const STORAGE_KEY_ACCOUNT_ID = 'bellum_analysis_account_id';
const STORAGE_KEY_QUERY = 'bellum_analysis_query';

function clearPersistedAnalysis() {
  try {
    sessionStorage.removeItem(STORAGE_KEY_ACCOUNT_ID);
    sessionStorage.removeItem(STORAGE_KEY_QUERY);
  } catch {}
}

/** Appel direct à l'Edge Function pour avoir la réponse réelle (status + body) et afficher le vrai message d'erreur. */
async function invokeAnalyzeAccount(companyName: string, userContext?: string): Promise<{ accountId?: string; error?: string }> {
  await supabase.auth.refreshSession();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { error: 'Session expirée. Veuillez vous reconnecter.' };
  }
  const url = `${SUPABASE_URL}/functions/v1/analyze-account`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ companyName, userContext: userContext ?? undefined }),
  });
  const text = await res.text();
  let body: { accountId?: string; status?: string; error?: string } = {};
  try {
    body = JSON.parse(text);
  } catch {
    if (!res.ok) return { error: text.slice(0, 300) || `Erreur ${res.status} ${res.statusText}` };
    return { error: 'Réponse serveur invalide' };
  }
  if (!res.ok) return { error: body.error || text.slice(0, 300) || `Erreur ${res.status}` };
  return { accountId: body.accountId, error: body.error };
}

export function useAnalysisPolling() {
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const [state, setState] = useState<AnalysisState>({
    status: 'idle',
    accountId: null,
    account: null,
    contacts: [],
    angles: [],
    actionPlan: null,
    progress: 0,
    currentStep: '',
    error: null,
    correctedName: null,
    originalQuery: null,
    notFound: false,
    alternativeSuggestions: [],
  });

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    stopPolling();
    clearPersistedAnalysis();
    setState({
      status: 'idle',
      accountId: null,
      account: null,
      contacts: [],
      angles: [],
      actionPlan: null,
      progress: 0,
      currentStep: '',
      error: null,
      correctedName: null,
      originalQuery: null,
      notFound: false,
      alternativeSuggestions: [],
    });
  }, [stopPolling]);

  const startAnalysis = useCallback(async (companyName: string, userContext?: string) => {
    stopPolling();
    // Normalisation : trim + espaces multiples → un seul (pour noms mal tapés ou copiés-collés)
    const normalized = (companyName ?? '').trim().replace(/\s+/g, ' ');
    const parsed = analyzeAccountSchema.safeParse({
      companyName: normalized,
      userContext: userContext ?? undefined,
    });
    if (!parsed.success) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        error: parsed.error.errors[0]?.message ?? 'Données invalides',
      }));
      return;
    }
    const trimmedName = parsed.data.companyName;
    setState({
      status: 'loading',
      accountId: null,
      account: null,
      contacts: [],
      angles: [],
      actionPlan: null,
      progress: 5,
      currentStep: 'Lancement de l\'analyse...',
      error: null,
      originalQuery: trimmedName,
      correctedName: null,
      notFound: false,
      alternativeSuggestions: [],
    });

    try {
      const result = await invokeAnalyzeAccount(trimmedName, parsed.data.userContext);

      if (result.error) {
        throw new Error(result.error);
      }
      const accountId = result.accountId;
      if (!accountId) {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Réponse serveur invalide (pas d’accountId)',
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        status: 'analyzing',
        accountId,
        progress: 15,
        currentStep: 'Recherche web en cours...',
      }));
      try {
        sessionStorage.setItem(STORAGE_KEY_ACCOUNT_ID, accountId);
        sessionStorage.setItem(STORAGE_KEY_QUERY, trimmedName);
      } catch {}

      // Polling toutes les 2 secondes
      intervalRef.current = setInterval(async () => {
        try {
          const { data: account } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

          if (!account) return;

          // Erreur
          if (account.status === 'error') {
            stopPolling();
            clearPersistedAnalysis();
            setState(prev => ({
              ...prev,
              status: 'error',
              error: account.error_message || 'Erreur inconnue',
            }));
            return;
          }

          // Récupérer les données associées
          const { data: contacts } = await supabase
            .from('contacts')
            .select('*')
            .eq('account_id', accountId)
            .order('priority');

          const { data: angles } = await supabase
            .from('attack_angles')
            .select('*')
            .eq('account_id', accountId)
            .order('rank');

          const { data: plans } = await supabase
            .from('action_plans')
            .select('*')
            .eq('account_id', accountId);

          // Calculer la progression
          let progress = 15;
          let currentStep = 'Recherche web en cours...';

          if (account.sector) {
            progress = 30;
            currentStep = 'Fiche compte prête — Scraping LinkedIn en cours...';
          }
          if (contacts && contacts.length > 0) {
            progress = 60;
            currentStep = 'Contacts identifiés — Enrichissement en cours...';
          }
          if (angles && angles.length > 0) {
            progress = 80;
            currentStep = 'Plan d\'attaque prêt — Génération des messages...';
          }
          let correctedName: string | null = null;
          let notFound = false;
          let alternativeSuggestions: string[] = [];
          if (account.status === 'completed' && account.raw_analysis) {
            const raw = account.raw_analysis as { companyNameCorrected?: string; notFound?: boolean; suggestions?: string[] };
            correctedName = raw.companyNameCorrected || null;
            notFound = !!raw.notFound;
            alternativeSuggestions = Array.isArray(raw.suggestions) ? raw.suggestions : [];
          }

          if (account.status === 'completed') {
            progress = 100;
            currentStep = 'Analyse terminée !';
            stopPolling();
            clearPersistedAnalysis();
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['credits'] });
          }

          setState(prev => ({
            status: account.status === 'completed' ? 'completed' : 'analyzing',
            accountId,
            account: account as AccountAnalysis,
            contacts: (contacts || []) as Contact[],
            angles: (angles || []) as AttackAngle[],
            actionPlan: (plans?.[0] || null) as ActionPlan | null,
            progress,
            currentStep,
            error: null,
            originalQuery: prev.originalQuery,
            correctedName,
            notFound,
            alternativeSuggestions,
          }));
        } catch (err) {
          // Erreur de polling, on continue
          console.error('Polling error:', err);
        }
      }, 2000);

      // Timeout après 5 minutes
      setTimeout(() => stopPolling(), 300000);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du lancement';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: msg,
      }));
    }
  }, [stopPolling, queryClient]);

  const resumeAnalysis = useCallback(() => {
    let accountId: string;
    let query: string;
    try {
      accountId = sessionStorage.getItem(STORAGE_KEY_ACCOUNT_ID) ?? '';
      query = sessionStorage.getItem(STORAGE_KEY_QUERY) ?? '';
    } catch {
      return;
    }
    if (!accountId) return;
    stopPolling();
    setState({
      status: 'analyzing',
      accountId,
      account: null,
      contacts: [],
      angles: [],
      actionPlan: null,
      progress: 15,
      currentStep: 'Reprise du suivi…',
      error: null,
      originalQuery: query,
      correctedName: null,
      notFound: false,
      alternativeSuggestions: [],
    });
    intervalRef.current = setInterval(async () => {
      try {
        const { data: account } = await supabase.from('accounts').select('*').eq('id', accountId).single();
        if (!account) return;
        if (account.status === 'error') {
          stopPolling();
          clearPersistedAnalysis();
          setState(prev => ({ ...prev, status: 'error', error: account.error_message || 'Erreur inconnue' }));
          return;
        }
        const { data: contacts } = await supabase.from('contacts').select('*').eq('account_id', accountId).order('priority');
        const { data: angles } = await supabase.from('attack_angles').select('*').eq('account_id', accountId).order('rank');
        const { data: plans } = await supabase.from('action_plans').select('*').eq('account_id', accountId);
        let progress = 15;
        let currentStep = 'Recherche web en cours...';
        if (account.sector) { progress = 30; currentStep = 'Fiche compte prête — Scraping LinkedIn en cours...'; }
        if (contacts && contacts.length > 0) { progress = 60; currentStep = 'Contacts identifiés — Enrichissement en cours...'; }
        if (angles && angles.length > 0) { progress = 80; currentStep = 'Plan d\'attaque prêt — Génération des messages...'; }
        let correctedName: string | null = null;
        let notFound = false;
        let alternativeSuggestions: string[] = [];
        if (account.status === 'completed' && account.raw_analysis) {
          const raw = account.raw_analysis as { companyNameCorrected?: string; notFound?: boolean; suggestions?: string[] };
          correctedName = raw.companyNameCorrected || null;
          notFound = !!raw.notFound;
          alternativeSuggestions = Array.isArray(raw.suggestions) ? raw.suggestions : [];
        }
        if (account.status === 'completed') {
          progress = 100;
          currentStep = 'Analyse terminée !';
          stopPolling();
          clearPersistedAnalysis();
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          queryClient.invalidateQueries({ queryKey: ['credits'] });
        }
        setState(prev => ({
          status: account.status === 'completed' ? 'completed' : 'analyzing',
          accountId,
          account: account as AccountAnalysis,
          contacts: (contacts || []) as Contact[],
          angles: (angles || []) as AttackAngle[],
          actionPlan: (plans?.[0] || null) as ActionPlan | null,
          progress,
          currentStep,
          error: null,
          originalQuery: prev.originalQuery,
          correctedName,
          notFound,
          alternativeSuggestions,
        }));
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);
    setTimeout(() => stopPolling(), 300000);
  }, [stopPolling, queryClient]);

  return { state, startAnalysis, stopPolling, resetState, resumeAnalysis };
}
