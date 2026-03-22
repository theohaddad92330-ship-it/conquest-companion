import { supabase } from '@/integrations/supabase/client';
import { analyzeAccountSchema } from '@/lib/validation';
import { authedPostJson } from '@/lib/supabase-http';

export async function analyzeAccount(companyName: string, userContext?: string) {
  const parsed = analyzeAccountSchema.safeParse({ companyName, userContext });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Données invalides');
  }

  const res = await authedPostJson<{ accountId?: string; status?: string; error?: string }>('analyze-account', {
    companyName: parsed.data.companyName,
    userContext: parsed.data.userContext ?? undefined,
  });
  if (!res.ok) throw new Error(res.error);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}
