import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserCredits } from '@/types/account';
import { useAuth } from '@/contexts/AuthContext';

export function useCredits() {
  const { user } = useAuth();

  const { data: credits, isLoading } = useQuery({
    queryKey: ['credits', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_credits').select('*').single();
      if (error) throw error;
      return data as UserCredits;
    },
    enabled: !!user,
  });

  const canAnalyze = credits ? credits.accounts_used < credits.accounts_limit : false;
  const usagePercent = credits
    ? Math.round((credits.accounts_used / Math.max(credits.accounts_limit, 1)) * 100)
    : 0;

  return { credits, isLoading, canAnalyze, usagePercent };
}

