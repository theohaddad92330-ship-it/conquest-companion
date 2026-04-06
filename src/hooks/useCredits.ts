import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserCredits } from '@/types/account';
import { useAuth } from '@/contexts/AuthContext';

const db = supabase as any;

export function useCredits() {
  const { user } = useAuth();
  const { data: credits, isLoading, refetch } = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from('user_credits')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data as UserCredits | null;
    },
    enabled: !!user,
  });

  const canAnalyze = credits ? credits.accounts_used < credits.accounts_limit : false;
  const usagePercent = credits ? Math.round((credits.accounts_used / credits.accounts_limit) * 100) : 0;
  const contactsPercent = credits ? Math.round((credits.contacts_enriched / credits.contacts_limit) * 100) : 0;
  const remaining = credits ? credits.accounts_limit - credits.accounts_used : 0;

  return { credits, isLoading, canAnalyze, usagePercent, contactsPercent, remaining, refetch };
}
