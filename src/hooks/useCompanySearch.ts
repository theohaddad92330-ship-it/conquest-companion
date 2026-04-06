import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { companySearchSchema } from '@/lib/validation';
import { authedPostJson } from '@/lib/supabase-http';

export interface CompanySuggestion {
  name: string;
  siren: string | null;
  city: string | null;
  postalCode: string | null;
  sector: string | null;
  employees: string | null;
  legalForm: string | null;
}

export function useCompanySearch() {
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchWarning, setSearchWarning] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchError(null);
    setSearchWarning(null);

    const parsed = companySearchSchema.safeParse({ query });
    if (!parsed.success) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await authedPostJson<any>('search-companies', {
          query: parsed.data.query,
        });
        if (!res.ok) {
          setSuggestions([]);
          setSearchError(res.error);
        } else {
          setSuggestions(res.data?.results || []);
          setSearchWarning(res.data?.warning || null);
        }
      } catch {
        setSuggestions([]);
        setSearchError('Erreur lors de la recherche');
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => {
    setSuggestions([]);
    setSearchError(null);
    setSearchWarning(null);
    setIsSearching(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { suggestions, isSearching, searchError, searchWarning, search, clear };
}
