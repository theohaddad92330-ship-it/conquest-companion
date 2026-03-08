import { useState, useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Zap, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

const MAX_PROFILE_REFETCH_ATTEMPTS = 3;

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Link to="/" className="inline-flex items-center gap-2">
        <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        <span className="font-display text-xl font-bold">Bellum AI</span>
      </Link>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Chargement…</p>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetch } = useProfile();
  const location = useLocation();
  const [refetchAttempts, setRefetchAttempts] = useState(0);

  // Refetch du profil quand il est null après connexion (évite redirection à tort avant que le fetch ne revienne)
  useEffect(() => {
    if (!user || authLoading || profileLoading || profile !== null || refetchAttempts >= MAX_PROFILE_REFETCH_ATTEMPTS) {
      return;
    }
    refetch().then(() => setRefetchAttempts((a) => a + 1));
  }, [user, authLoading, profileLoading, profile, refetchAttempts, refetch]);

  // Ne jamais rediriger pendant le chargement
  if (authLoading === true || profileLoading === true) {
    return <LoadingScreen />;
  }

  if (!user) return <Navigate to="/login" replace />;

  const isOnboardingFlow = ["/welcome", "/onboarding"].includes(location.pathname);

  // Connecté mais onboarding non terminé → welcome (puis questionnaire)
  if (!isOnboardingFlow && profile && profile.onboarding_completed === false) {
    return <Navigate to="/welcome" replace />;
  }
  // Profil absent après plusieurs tentatives de refetch → onboarding pour créer le profil
  if (!isOnboardingFlow && profile === null) {
    if (refetchAttempts >= MAX_PROFILE_REFETCH_ATTEMPTS) {
      return <Navigate to="/onboarding" replace />;
    }
    return <LoadingScreen />;
  }

  return <>{children}</>;
}
