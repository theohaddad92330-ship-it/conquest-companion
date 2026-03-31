import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: unknown; session?: Session | null; user?: User | null }>;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signInWithGoogle: () => Promise<{ error: unknown }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const userInitiatedSignOut = useRef(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === "SIGNED_OUT") {
          if (!userInitiatedSignOut.current) {
            toast({ title: "Session expirée", description: "Votre session a expiré, veuillez vous reconnecter.", variant: "destructive" });
            navigate("/login", { replace: true });
          }
          userInitiatedSignOut.current = false;
        }
        if (event === "TOKEN_REFRESHED" && !session) {
          toast({ title: "Session expirée", description: "Votre session a expiré, veuillez vous reconnecter.", variant: "destructive" });
          navigate("/login", { replace: true });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/welcome`,
      },
    });
    return { error, session: data?.session, user: data?.user };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      console.warn("[signInWithGoogle] Erreur:", error.message, error);
      return { error };
    }
    if (data?.url) {
      console.log("[signInWithGoogle] Redirection vers:", data.url);
      window.location.href = data.url;
      return { error: null };
    }
    console.warn("[signInWithGoogle] Pas d'URL de redirection reçue", { data });
    return { error: new Error("Pas d'URL de redirection OAuth") };
  };

  const signOut = async () => {
    userInitiatedSignOut.current = true;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
