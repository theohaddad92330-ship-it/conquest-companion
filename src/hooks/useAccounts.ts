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

export function useAccounts(options?: { includeArchived?: boolean }) {
  const { user } = useAuth();
  const includeArchived = options?.includeArchived ?? false;
  const { data: accounts = [], isLoading, error, refetch } = useQuery({
    queryKey: ['accounts', user?.id, includeArchived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      let list = (data || []) as (AccountAnalysis & { contact_count?: number; message_count?: number; archived_at?: string | null })[];
      if (!includeArchived) {
        list = list.filter((a) => a.archived_at == null);
      }
      // Scalabilité: ces stats sont maintenues côté DB (colonnes accounts.contact_count / accounts.message_count)
      return list;
    },
    enabled: !!user,
  });
  return { accounts, isLoading, error, refetch };
}

/** Supprime définitivement un compte (et ses contacts, angles, plans en cascade). */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return async (accountId: string) => {
    const { error } = await supabase.from('accounts').delete().eq('id', accountId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['account', accountId] });
  };
}

/** Archive un compte (masqué de la liste par défaut). */
export function useArchiveAccount() {
  const queryClient = useQueryClient();
  return async (accountId: string) => {
    const { error } = await supabase
      .from('accounts')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', accountId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    queryClient.invalidateQueries({ queryKey: ['account', accountId] });
  };
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
  const { data: contacts = [], isLoading, refetch } = useQuery({
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
    refetchInterval: (query) => {
      const list = query.state.data;
      return Array.isArray(list) && list.length === 0 ? 3000 : false;
    },
  });
  return { contacts, isLoading, refetch };
}

export function useAccountAngles(accountId: string | undefined) {
  const { data: angles = [], isLoading, refetch } = useQuery({
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
    refetchInterval: (query) => {
      const list = query.state.data;
      return Array.isArray(list) && list.length === 0 ? 3000 : false;
    },
  });
  return { angles, isLoading, refetch };
}

export function useAccountActionPlan(accountId: string | undefined) {
  const { data: actionPlan, isLoading, refetch } = useQuery({
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
    refetchInterval: (query) => {
      return query.state.data == null ? 3000 : false;
    },
  });
  return { actionPlan, isLoading, refetch };
}
