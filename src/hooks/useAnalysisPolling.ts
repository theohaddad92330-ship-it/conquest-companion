import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AnalysisState, AccountAnalysis, Contact, AttackAngle, ActionPlan } from '@/types/account';
import { useQueryClient } from '@tanstack/react-query';

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
  });

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startAnalysis = useCallback(async (companyName: string, userContext?: string) => {
    stopPolling();
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
    });

    try {
      // Appeler l'Edge Function
      const { data, error } = await supabase.functions.invoke('analyze-account', {
        body: { companyName, userContext },
      });

      if (error) throw error;
      const accountId = data.accountId;

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
            progress = 40;
            currentStep = 'Fiche compte prête — Identification des contacts...';
          }
          if (contacts && contacts.length > 0) {
            progress = 65;
            currentStep = 'Contacts identifiés — Préparation du plan d\'attaque...';
          }
          if (angles && angles.length > 0) {
            progress = 80;
            currentStep = 'Plan d\'attaque prêt — Génération des messages...';
          }
          if (account.status === 'completed') {
            progress = 100;
            currentStep = 'Analyse terminée !';
            stopPolling();
            // Invalider les caches pour que le dashboard se mette à jour
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['credits'] });
          }

          setState({
            status: account.status === 'completed' ? 'completed' : 'analyzing',
            accountId,
            account: account as AccountAnalysis,
            contacts: (contacts || []) as Contact[],
            angles: (angles || []) as AttackAngle[],
            actionPlan: (plans?.[0] || null) as ActionPlan | null,
            progress,
            currentStep,
            error: null,
          });
        } catch (err) {
          // Erreur de polling, on continue
          console.error('Polling error:', err);
        }
      }, 2000);

      // Timeout après 5 minutes
      setTimeout(() => stopPolling(), 300000);

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error.message || 'Erreur lors du lancement',
      }));
    }
  }, [stopPolling, queryClient]);

  return { state, startAnalysis, stopPolling };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { analyzeAccount } from '@/lib/api';
import { AnalysisState } from '@/types/account';

export function useAnalysisPolling() {
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const [state, setState] = useState<AnalysisState>({
    status: 'idle',
    account: null,
    contacts: [],
    angles: [],
    actionPlan: null,
    progress: 0,
    currentStep: '',
    error: null,
  });

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const startAnalysis = useCallback(async (companyName: string, userContext?: string) => {
    setState({
      status: 'loading',
      account: null,
      contacts: [],
      angles: [],
      actionPlan: null,
      progress: 5,
      currentStep: "Lancement de l'analyse...",
      error: null,
    });

    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    try {
      const { accountId } = await analyzeAccount(companyName, userContext);

      setState((prev) => ({
        ...prev,
        status: 'step1_research',
        progress: 15,
        currentStep: 'Recherche web en cours...',
      }));

      intervalRef.current = window.setInterval(async () => {
        const { data: account } = await supabase.from('accounts').select('*').eq('id', accountId).single();
        if (!account) return;

        if (account.status === 'error') {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: account.error_message || 'Erreur pendant analyse',
          }));
          return;
        }

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

        const { data: plans } = await supabase.from('action_plans').select('*').eq('account_id', accountId);

        let progress = 15;
        let currentStep = 'Recherche web en cours...';
        let status: AnalysisState['status'] = 'step1_research';

        if (account.sector) {
          progress = 40;
          currentStep = 'Fiche compte prête — Identification des contacts...';
          status = 'step2_analysis';
        }
        if (contacts && contacts.length > 0) {
          progress = 65;
          currentStep = "Contacts identifiés — Préparation du plan d'attaque...";
          status = 'step3_contacts';
        }
        if (angles && angles.length > 0) {
          progress = 80;
          currentStep = "Plan d'attaque prêt — Génération des messages...";
          status = 'step4_plan';
        }
        if (account.status === 'completed') {
          progress = 100;
          currentStep = 'Analyse terminée !';
          status = 'completed';
          if (intervalRef.current) window.clearInterval(intervalRef.current);
        }

        setState({
          status,
          account,
          contacts: contacts || [],
          angles: angles || [],
          actionPlan: plans?.[0] || null,
          progress,
          currentStep,
          error: null,
        });
      }, 2000);

      timeoutRef.current = window.setTimeout(() => {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
      }, 300000);
    } catch (error: any) {
      setState((prev) => ({ ...prev, status: 'error', error: error?.message || 'Erreur inconnue' }));
    }
  }, []);

  return { state, startAnalysis };
}

