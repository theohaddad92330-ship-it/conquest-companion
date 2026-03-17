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
      let list = (data || []) as (AccountAnalysis & { contact_count?: number; archived_at?: string | null })[];
      if (!includeArchived) {
        list = list.filter((a) => a.archived_at == null);
      }
      if (list.length === 0) return list;
      const accountIds = list.map((a) => a.id);
      const { data: contactRows } = await supabase
        .from('contacts')
        .select('account_id')
        .in('account_id', accountIds);
      const countByAccount: Record<string, number> = {};
      for (const row of contactRows || []) {
        const id = (row as { account_id: string }).account_id;
        countByAccount[id] = (countByAccount[id] || 0) + 1;
      }
      return list.map((a) => ({ ...a, contact_count: countByAccount[a.id] ?? 0 }));
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
