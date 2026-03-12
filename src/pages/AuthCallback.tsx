import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { BellumLogo } from "@/components/BellumLogo";

/**
 * Page de callback OAuth (Google, etc.).
 * Supabase redirige ici après Google avec ?code=... (PKCE) ou #access_token=... (implicit).
 * On échange le code / récupère la session puis on redirige vers /dashboard ou /login.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash?.slice(1) || "");
        const code = params.get("code");
        const errorParam = params.get("error") || hashParams.get("error");

        if (errorParam) {
          const desc = params.get("error_description") || hashParams.get("error_description") || errorParam;
          console.error("[AuthCallback] OAuth error in URL:", errorParam, desc);
          setErrorMessage(desc || "Erreur de connexion Google.");
          setStatus("error");
          setTimeout(() => navigate("/login", { replace: true }), 3000);
          return;
        }

        // Flux PKCE : Supabase renvoie ?code=... → il faut échanger contre une session
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (error) {
            console.error("[AuthCallback] exchangeCodeForSession error:", error);
            setErrorMessage(error.message || "Échec de la connexion.");
            setStatus("error");
            setTimeout(() => navigate("/login", { replace: true }), 3000);
            return;
          }
          if (data?.session?.user) {
            setStatus("ok");
            navigate("/dashboard", { replace: true });
            return;
          }
        }

        // Flux implicit (hash) ou session déjà récupérée par le client
        let { data: { session }, error } = await supabase.auth.getSession();
        if (!session?.user && !error) {
          await new Promise((r) => setTimeout(r, 400));
          const next = await supabase.auth.getSession();
          session = next.data.session;
          error = next.error;
        }
        if (cancelled) return;
        if (error) {
          console.error("[AuthCallback] getSession error:", error);
          setErrorMessage(error.message || "Session introuvable.");
          setStatus("error");
          setTimeout(() => navigate("/login", { replace: true }), 3000);
          return;
        }
        if (session?.user) {
          setStatus("ok");
          navigate("/dashboard", { replace: true });
        } else {
          setErrorMessage("Aucune session après connexion.");
          setStatus("error");
          setTimeout(() => navigate("/login", { replace: true }), 3000);
        }
      } catch (err) {
        console.error("[AuthCallback] Error:", err);
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : "Erreur inattendue.");
          setStatus("error");
          setTimeout(() => navigate("/login", { replace: true }), 3000);
        }
      }
    }

    handleCallback();
    return () => { cancelled = true; };
  }, [navigate]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <BellumLogo size={36} className="rounded-lg" />
          <span className="font-display text-xl font-bold">Bellum AI</span>
        </Link>
        <p className="text-sm text-destructive text-center max-w-sm">{errorMessage}</p>
        <p className="text-xs text-muted-foreground">Redirection vers la connexion…</p>
        <Link to="/login" className="text-sm text-primary underline">Retour à la connexion</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <Link to="/" className="inline-flex items-center gap-2">
        <BellumLogo size={36} className="rounded-lg" />
        <span className="font-display text-xl font-bold">Bellum AI</span>
      </Link>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Connexion en cours…</p>
    </div>
  );
}
