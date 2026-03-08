import { supabase } from '@/integrations/supabase/client';
import { analyzeAccountSchema } from '@/lib/validation';

export async function analyzeAccount(companyName: string, userContext?: string) {
  const parsed = analyzeAccountSchema.safeParse({ companyName, userContext });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Données invalides');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  const response = await supabase.functions.invoke('analyze-account', {
    body: {
      companyName: parsed.data.companyName,
      userContext: parsed.data.userContext ?? undefined,
    },
  });

  if (response.error) {
    const msg = (response.data && typeof response.data === 'object' && 'error' in response.data
      ? (response.data as { error?: string }).error
      : null) ?? response.error.message;
    throw new Error(msg ?? 'Erreur lors de l\'analyse');
  }
  return response.data;
}
