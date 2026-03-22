import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnalysisState, AccountAnalysis, Contact, AttackAngle, ActionPlan } from '@/types/account';
import { useQueryClient } from '@tanstack/react-query';
import { analyzeAccountSchema } from '@/lib/validation';
import { authedPostJson } from '@/lib/supabase-http';

const STORAGE_KEY_ACCOUNT_ID = 'bellum_analysis_account_id';
const STORAGE_KEY_QUERY = 'bellum_analysis_query';

function clearPersistedAnalysis() {
  try {
    sessionStorage.removeItem(STORAGE_KEY_ACCOUNT_ID);
    sessionStorage.removeItem(STORAGE_KEY_QUERY);
  } catch {}
}

/** Edge Function analyze-account — wrapper stable (évite divergences fetch/invoke). */
async function invokeAnalyzeAccount(companyName: string, userContext?: string): Promise<{ accountId?: string; error?: string }> {
  const res = await authedPostJson<{ accountId?: string; error?: string }>("analyze-account", {
    companyName,
    userContext: userContext ?? undefined,
  });
  if (!res.ok) return { error: res.error };
  if (res.data?.error) return { error: res.data.error };
  if (!res.data?.accountId) return { error: "Réponse serveur invalide (pas d’accountId)" };
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
          const { data: account, error: accountErr } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', accountId)
            .single();

          if (accountErr || !account) {
            pollErrorCountRef.current += 1;
            // Après quelques tentatives, on affiche une erreur claire au lieu de “charger dans le vide”.
            if (pollErrorCountRef.current >= 3) {
              stopPolling();
              clearPersistedAnalysis();
              setState(prev => ({
                ...prev,
                status: 'error',
                error:
                  accountErr?.message
                    ? `Impossible de lire l’analyse (permissions/connexion) : ${accountErr.message}`
                    : "Analyse introuvable (le compte n’a pas été créé ou n’est pas accessible).",
              }));
            }
            return;
          }
          pollErrorCountRef.current = 0;

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

          // Calculer la progression (libellés centrés agent — pas de mention d'outils)
          let progress = 15;
          let currentStep = 'Bellum analyse le périmètre et les signaux...';

          // Source de vérité si disponible (backend écrit analysis_step/progress)
          const step = (account as any).analysis_step as string | null | undefined;
          const stepProgress = (account as any).analysis_progress as number | null | undefined;
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
              error: "Erreur pendant l'analyse…",
            };
            currentStep = map[step] || currentStep;
          }

          // Fallback heuristique si analysis_step/progress non présents
          if (!step) {
            if (account.sector) {
              progress = 30;
              currentStep = "Fiche compte prête — identification des décideurs et portes d'entrée...";
            }
            if (contacts && contacts.length > 0) {
              progress = 60;
              currentStep = 'Contacts identifiés — structuration en cours...';
            }
            if (angles && angles.length > 0) {
              progress = 80;
              currentStep = "Plan d'attaque prêt — finalisation...";
            }
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
          pollErrorCountRef.current += 1;
          console.error('Polling error:', err);
          if (pollErrorCountRef.current >= 3) {
            stopPolling();
            clearPersistedAnalysis();
            setState(prev => ({
              ...prev,
              status: 'error',
              error: err instanceof Error ? err.message : 'Erreur de suivi de l’analyse',
            }));
          }
        }
      }, 2000);

      // Arrêt du polling après 10 min (le backend coupe à 8 min et met status error — on laisse le temps de le récupérer)
      setTimeout(() => stopPolling(), 600000);

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
