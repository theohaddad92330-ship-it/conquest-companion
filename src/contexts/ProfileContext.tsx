import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  onboarding_data: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

type ProfileContextType = {
  profile: Profile | null;
  loading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: unknown; data: Profile | null }>;
  refetch: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as unknown as Profile);
      } else {
        console.warn("[ProfileContext] Profil inexistant, création en cours...");
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
            onboarding_completed: false,
          })
          .select()
          .single();

        if (!insertError && newProfile) {
          setProfile(newProfile as unknown as Profile);
        } else {
          console.error("[ProfileContext] Échec création profil:", insertError);
          setProfile(null);
        }
      }
    } catch (err) {
      console.error("[ProfileContext] fetchProfile error:", err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user) return { error: new Error("Not authenticated"), data: null };

      try {
        const { data, error } = await supabase
          .from("profiles")
          .update(updates as any)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) {
          console.warn("[ProfileContext] UPDATE échoué, tentative UPSERT:", error.message);
          const { data: upsertData, error: upsertError } = await supabase
            .from("profiles")
            .upsert({
              user_id: user.id,
              full_name: user.user_metadata?.full_name || "",
              onboarding_completed: false,
              ...updates,
            } as any)
            .select()
            .single();

          if (!upsertError && upsertData) {
            setProfile(upsertData as unknown as Profile);
            return { error: null, data: upsertData as unknown as Profile };
          }
          console.error("[ProfileContext] UPSERT échoué:", upsertError);
          return { error: upsertError, data: null };
        }

        if (data) {
          setProfile(data as unknown as Profile);
          return { error: null, data: data as unknown as Profile };
        }
        return { error: null, data: null };
      } catch (err) {
        console.error("[ProfileContext] updateProfile error:", err);
        return { error: err instanceof Error ? err : new Error(String(err)), data: null };
      }
    },
    [user]
  );

  return (
    <ProfileContext.Provider value={{ profile, loading, updateProfile, refetch }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfileContext must be used within ProfileProvider");
  return ctx;
}
