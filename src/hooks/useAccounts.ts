import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccountAnalysis } from '@/types/account';
import { useAuth } from '@/contexts/AuthContext';

/** Met à jour un compte "analyzing" en "error" (annulé) pour arrêter l'analyse. */
export function useCancelAnalysis() {
  const queryClient = useQueryClient();
  return async (accountId: string) => {
    const { error } = await supabase
      .from('accounts')
      .update({
        status: 'error',
        error_message: "Annulé par l'utilisateur",
      })
      .eq('id', accountId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['account', accountId] });
  };
}

export function useAccounts() {
  const { user } = useAuth();
  const { data: accounts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['accounts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as AccountAnalysis[];
    },
    enabled: !!user,
  });
  return { accounts, isLoading, error, refetch };
}

export function useAccount(id: string | undefined, options?: { refetchWhenAnalyzing?: boolean }) {
  const { user } = useAuth();
  const { data: account, isLoading, error, refetch } = useQuery({
    queryKey: ['account', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as AccountAnalysis;
    },
    enabled: !!user && !!id,
    refetchInterval: options?.refetchWhenAnalyzing
      ? (query) => (query.state.data as AccountAnalysis)?.status === 'analyzing' ? 2000 : false
      : undefined,
  });
  return { account, isLoading, error, refetch };
}

export function useAccountContacts(accountId: string | undefined) {
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('account_id', accountId)
        .order('priority', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });
  return { contacts, isLoading };
}

export function useAccountAngles(accountId: string | undefined) {
  const { data: angles = [], isLoading } = useQuery({
    queryKey: ['angles', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from('attack_angles')
        .select('*')
        .eq('account_id', accountId)
        .order('rank', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!accountId,
  });
  return { angles, isLoading };
}

export function useAccountActionPlan(accountId: string | undefined) {
  const { data: actionPlan, isLoading } = useQuery({
    queryKey: ['action_plan', accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await supabase
        .from('action_plans')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });
  return { actionPlan, isLoading };
}
