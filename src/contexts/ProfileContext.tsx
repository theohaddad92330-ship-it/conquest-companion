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
  const [lastError, setLastError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      setLastError(null);
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
        setLastError(null);
      } else {
        // Ne pas auto-créer ici: la DB a déjà un trigger de création au signup.
        // Si le profil est absent, c'est soit un utilisateur legacy, soit un souci RLS/migration.
        // Laisser la UI (onboarding) déclencher un upsert explicite si nécessaire.
        if (error) {
          console.warn("[ProfileContext] fetch profile error:", error.message);
          setLastError(error.message);
        } else {
          setLastError("Profil introuvable");
        }
        setProfile(null);
      }
    } catch (err) {
      console.error("[ProfileContext] fetchProfile error:", err);
      setProfile(null);
      setLastError(err instanceof Error ? err.message : String(err));
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
        // UPSERT explicite: garantit la création pour les users legacy
        const { data, error } = await supabase
          .from("profiles")
          .upsert({
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
            onboarding_completed: false,
            ...updates,
          } as any, { onConflict: "user_id" })
          .select()
          .single();

        if (data) {
          setProfile(data as unknown as Profile);
          setLastError(null);
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
