import { Link, useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const GOOGLE_NOT_CONFIGURED_MSG = "La connexion Google n'est pas encore disponible. Utilisez votre email.";
const AUTH_TIMEOUT_MS = 15000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = window.setTimeout(() => reject(new Error(`${label} (timeout ${ms}ms)`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) window.clearTimeout(t);
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState<{ step: string; at: number; detail?: string } | null>(null);
  const { user, signIn, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!user) {
      hasRedirected.current = false;
      return;
    }
    if (hasRedirected.current) return;
    hasRedirected.current = true;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await withTimeout(
          supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("user_id", user.id)
            .maybeSingle(),
          AUTH_TIMEOUT_MS,
          "Chargement du profil"
        );
        if (cancelled) return;
        if (data?.onboarding_completed === true) navigate("/dashboard", { replace: true });
        else navigate("/welcome", { replace: true });
      } catch (err) {
        if (cancelled) return;
        console.error("[login] profile fetch failed", err);
        // Ne pas bloquer l'utilisateur si la table profiles/RLS pose problème
        navigate("/dashboard", { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs.", variant: "destructive" });
      return;
    }
    setDebug({ step: "submit_clicked", at: Date.now() });
    setLoading(true);
    try {
      setDebug({ step: "signIn_start", at: Date.now() });
      const { error } = await withTimeout(signIn(email, password), AUTH_TIMEOUT_MS, "Connexion");
      setDebug({ step: "signIn_done", at: Date.now(), detail: error ? String((error as any)?.message || error) : "ok" });
      if (error) {
        const msg = (error as Error).message?.includes("Invalid login")
          ? "Email ou mot de passe incorrect."
          : (error as Error).message || "Une erreur est survenue.";
        toast({ title: "Erreur de connexion", description: msg, variant: "destructive" });
      }
    } catch (err) {
      setDebug({ step: "signIn_throw", at: Date.now(), detail: err instanceof Error ? err.message : String(err) });
      console.error("[login] signIn failed", err);
      toast({
        title: "Connexion impossible",
        description: err instanceof Error ? err.message : "Une erreur réseau est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
    // La redirection est gérée par le useEffect qui réagit à user
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);
    if (error) {
      toast({ title: "Connexion Google", description: GOOGLE_NOT_CONFIGURED_MSG, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <Card className="w-full max-w-sm border-border">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <Zap className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <span className="font-display text-xl font-bold">Bellum AI</span>
            </Link>
            <h1 className="font-display text-2xl font-bold">Connectez-vous</h1>
          </div>

          <Button variant="outline" className="w-full h-11 gap-2" onClick={handleGoogle} disabled={loading}>
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continuer avec Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">ou</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" placeholder="john@esn.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mot de passe</label>
              <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Mot de passe oublié ?</Link>
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter →"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Pas encore de compte ?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">Créer un compte</Link>
          </p>

          {import.meta.env.DEV ? (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <div><span className="font-medium">Debug login</span></div>
              <div>loading: {String(loading)}</div>
              <div>user: {user ? "yes" : "no"}</div>
              <div>step: {debug?.step || "none"}</div>
              <div>detail: {debug?.detail || ""}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
