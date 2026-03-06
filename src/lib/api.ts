import { supabase } from '@/integrations/supabase/client';

export async function analyzeAccount(companyName: string, userContext?: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await supabase.functions.invoke('analyze-account', {
    body: { companyName, userContext },
  });

  if (response.error) throw response.error;
  return response.data as { accountId: string; status: string };
}

