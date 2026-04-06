import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnalysisState, AccountAnalysis, Contact, AttackAngle, ActionPlan } from '@/types/account';
import { useQueryClient } from '@tanstack/react-query';
import { analyzeAccountSchema } from '@/lib/validation';
import { authedPostJson } from '@/lib/supabase-http';

// Cast needed: tables not yet in auto-generated types
const db = supabase as any;

const STORAGE_KEY_ACCOUNT_ID = 'bellum_analysis_account_id';
const STORAGE_KEY_QUERY = 'bellum_analysis_query';

function clearPersistedAnalysis() {
  try {
    sessionStorage.removeItem(STORAGE_KEY_ACCOUNT_ID);
    sessionStorage.removeItem(STORAGE_KEY_QUERY);
  } catch {}
}

interface CompanySelectionPayload {
  siren?: string | null;
  selectedName?: string | null;
}

async function invokeAnalyzeAccount(
  companyName: string,
  userContext?: string,
  selection?: CompanySelectionPayload
): Promise<{ accountId?: string; error?: string }> {
  const res = await authedPostJson<{ accountId?: string; error?: string }>("analyze-account", {
    companyName,
    userContext: userContext ?? undefined,
    companySiren: selection?.siren ?? undefined,
    selectedCompanyName: selection?.selectedName ?? undefined,
  });
  if (!res.ok) return { error: res.error };
  if (res.data?.error) return { error: typeof res.data.error === 'string' ? res.data.error : 'Erreur serveur' };
  if (!res.data?.accountId) return { error: "Réponse serveur invalide (pas d'accountId)" };
  return { accountId: res.data.accountId };
}

export function useAnalysisPolling() {
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollErrorCountRef = useRef(0);

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
    pollErrorCountRef.current = 0;
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

  const pollAccount = useCallback(async (accountId: string, stopFn: () => void) => {
    try {
      const { data: account, error: accountErr } = await db
        .from('accounts').select('*').eq('id', accountId).single();

      if (accountErr || !account) {
        pollErrorCountRef.current += 1;
        if (pollErrorCountRef.current >= 3) {
          stopFn();
          clearPersistedAnalysis();
          setState(prev => ({
            ...prev,
            status: 'error',
            error: accountErr?.message
              ? `Impossible de lire l'analyse : ${accountErr.message}`
              : "Analyse introuvable.",
          }));
        }
        return;
      }
      pollErrorCountRef.current = 0;

      if (account.status === 'error') {
        stopFn();
        clearPersistedAnalysis();
        setState(prev => ({ ...prev, status: 'error', error: account.error_message || 'Erreur inconnue' }));
        return;
      }

      const { data: contacts } = await db.from('contacts').select('*').eq('account_id', accountId).order('priority');
      const { data: angles } = await db.from('attack_angles').select('*').eq('account_id', accountId).order('rank');
      const { data: plans } = await db.from('action_plans').select('*').eq('account_id', accountId);

      let progress = 15;
      let currentStep = 'Bellum analyse le périmètre et les signaux...';

      const step = account.analysis_step as string | null | undefined;
      const stepProgress = account.analysis_progress as number | null | undefined;
      if (typeof stepProgress === 'number' && Number.isFinite(stepProgress)) {
        progress = Math.max(0, Math.min(100, Math.round(stepProgress)));
      }
      if (step) {
        const map: Record<string, string> = {
          queued: "Lancement de l'analyse…",
          phase1_research: 'Recherche web & signaux en cours…',
          phase1_saving: 'Construction de la fiche compte…',
          phase2_contacts_source: 'Recherche de contacts (LinkedIn / web)…',
          phase3_enrich_contacts: 'Structuration des contacts (sans messages)…',
          phase3_saving_contacts: 'Sauvegarde des contacts…',
          phase4_plan: "Génération du plan d'action…",
          messages_generating: 'Génération des messages (à la demande)…',
          completed: 'Analyse terminée !',
          timeout: "Temps maximum atteint — arrêt de l'analyse…",
          error_missing_keys: 'Configuration API incomplète — contactez le support.',
          error: "Erreur pendant l'analyse…",
        };
        currentStep = map[step] || currentStep;
      }

      if (!step) {
        if (account.sector) { progress = 30; currentStep = "Fiche compte prête — identification des décideurs..."; }
        if (contacts && contacts.length > 0) { progress = 60; currentStep = 'Contacts identifiés — structuration en cours...'; }
        if (angles && angles.length > 0) { progress = 80; currentStep = "Plan d'attaque prêt — finalisation..."; }
      }

      let correctedName: string | null = null;
      let notFound = false;
      let alternativeSuggestions: string[] = [];
      if (account.status === 'completed' && account.raw_analysis) {
        const raw = account.raw_analysis as any;
        correctedName = raw.companyNameCorrected || null;
        notFound = !!raw.notFound;
        alternativeSuggestions = Array.isArray(raw.suggestions) ? raw.suggestions : [];
      }

      if (account.status === 'completed') {
        progress = 100;
        currentStep = 'Analyse terminée !';
        stopFn();
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
      pollErrorCountRef.current += 1;
      console.error('Polling error:', err);
      if (pollErrorCountRef.current >= 3) {
        stopFn();
        clearPersistedAnalysis();
        setState(prev => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Erreur de suivi',
        }));
      }
    }
  }, [queryClient]);

  const startAnalysis = useCallback(async (
    companyName: string,
    userContext?: string,
    selection?: CompanySelectionPayload
  ) => {
    stopPolling();
    const normalized = (companyName ?? '').trim().replace(/\s+/g, ' ');
    const parsed = analyzeAccountSchema.safeParse({
      companyName: normalized,
      userContext: userContext ?? undefined,
      companySiren: selection?.siren ?? undefined,
      selectedCompanyName: selection?.selectedName ?? undefined,
    });
    if (!parsed.success) {
      setState(prev => ({ ...prev, status: 'idle', error: parsed.error.errors[0]?.message ?? 'Données invalides' }));
      return;
    }
    const trimmedName = parsed.data.companyName;
    setState({
      status: 'loading',
      accountId: null, account: null, contacts: [], angles: [], actionPlan: null,
      progress: 5, currentStep: 'Lancement de l\'analyse...', error: null,
      originalQuery: trimmedName, correctedName: null, notFound: false, alternativeSuggestions: [],
    });

    try {
      const result = await invokeAnalyzeAccount(trimmedName, parsed.data.userContext, {
        siren: parsed.data.companySiren ?? null,
        selectedName: parsed.data.selectedCompanyName ?? null,
      });
      if (result.error) throw new Error(result.error);
      const accountId = result.accountId;
      if (!accountId) {
        setState(prev => ({ ...prev, status: 'error', error: "Réponse serveur invalide" }));
        return;
      }

      setState(prev => ({ ...prev, status: 'analyzing', accountId, progress: 15, currentStep: 'Recherche web en cours...' }));
      try {
        sessionStorage.setItem(STORAGE_KEY_ACCOUNT_ID, accountId);
        sessionStorage.setItem(STORAGE_KEY_QUERY, trimmedName);
      } catch {}

      intervalRef.current = setInterval(() => pollAccount(accountId, stopPolling), 2000);
      setTimeout(() => stopPolling(), 600000);
    } catch (err) {
      setState(prev => ({ ...prev, status: 'error', error: err instanceof Error ? err.message : 'Erreur lors du lancement' }));
    }
  }, [stopPolling, pollAccount]);

  const resumeAnalysis = useCallback(() => {
    let accountId: string;
    let query: string;
    try {
      accountId = sessionStorage.getItem(STORAGE_KEY_ACCOUNT_ID) ?? '';
      query = sessionStorage.getItem(STORAGE_KEY_QUERY) ?? '';
    } catch { return; }
    if (!accountId) return;
    stopPolling();
    setState({
      status: 'analyzing', accountId, account: null, contacts: [], angles: [], actionPlan: null,
      progress: 15, currentStep: 'Reprise du suivi…', error: null,
      originalQuery: query, correctedName: null, notFound: false, alternativeSuggestions: [],
    });
    intervalRef.current = setInterval(() => pollAccount(accountId, stopPolling), 2000);
    setTimeout(() => stopPolling(), 300000);
  }, [stopPolling, pollAccount]);

  return { state, startAnalysis, stopPolling, resetState, resumeAnalysis };
}
