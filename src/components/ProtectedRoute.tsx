import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Allow access to welcome and onboarding pages even if onboarding not completed
  const isOnboardingFlow = ["/welcome", "/onboarding"].includes(location.pathname);

  // If onboarding not completed and not on onboarding flow, redirect
  if (profile && !profile.onboarding_completed && !isOnboardingFlow) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
