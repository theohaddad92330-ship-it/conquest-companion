import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnalysisState, AccountAnalysis, Contact, AttackAngle, ActionPlan } from '@/types/account';
import { useQueryClient } from '@tanstack/react-query';
import { analyzeAccountSchema } from '@/lib/validation';

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
    const parsed = analyzeAccountSchema.safeParse({
      companyName: companyName?.trim(),
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
      const { data, error } = await supabase.functions.invoke('analyze-account', {
        body: {
          companyName: trimmedName,
          userContext: parsed.data.userContext ?? undefined,
        },
      });

      if (error) {
        const msg = (data && typeof data === 'object' && 'error' in data
          ? (data as { error?: string }).error
          : null) || (error instanceof Error ? error.message : 'Erreur lors du lancement');
        throw new Error(msg);
      }
      const accountId = data?.accountId;
      if (!accountId) {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Réponse serveur invalide',
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

  return { state, startAnalysis, stopPolling, resetState };
}
