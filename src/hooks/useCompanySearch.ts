import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { companySearchSchema } from '@/lib/validation';

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchError(null);

    const parsed = companySearchSchema.safeParse({ query });
    if (!parsed.success) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('search-companies', {
          body: { query: parsed.data.query },
        });

        if (error) {
          setSuggestions([]);
          const msg = (data && typeof data === 'object' && 'error' in data
            ? (data as { error?: string }).error
            : null) || error.message || 'Erreur lors de la recherche';
          setSearchError(msg);
        } else {
          setSuggestions(data?.results || []);
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
    setIsSearching(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { suggestions, isSearching, searchError, search, clear };
}
