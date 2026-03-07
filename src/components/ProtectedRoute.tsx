import { Link, Navigate, useLocation } from "react-router-dom";
import { Zap, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";

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
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();

  // Ne jamais rediriger pendant le chargement : spinner logo + Loader2, jamais de page blanche
  if (authLoading === true || profileLoading === true) {
    return <LoadingScreen />;
  }

  if (!user) return <Navigate to="/login" replace />;

  // Pages autorisées sans avoir terminé le questionnaire
  const isOnboardingFlow = ["/welcome", "/onboarding"].includes(location.pathname);

  // Profil absent (trigger pas encore exécuté ou erreur) → considérer onboarding non fait
  const onboardingDone = profile?.onboarding_completed === true;
  if (!isOnboardingFlow && !onboardingDone) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
