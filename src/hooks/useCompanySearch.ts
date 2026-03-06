import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('search-companies', {
          body: { query: query.trim() },
        });

        if (error) {
          setSuggestions([]);
        } else {
          setSuggestions(data?.results || []);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => {
    setSuggestions([]);
    setIsSearching(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return { suggestions, isSearching, search, clear };
}
