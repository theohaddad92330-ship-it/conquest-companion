import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { BellumLogo } from "@/components/BellumLogo";

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-md">
        <Link to="/" className="inline-flex items-center gap-2">
          <BellumLogo size={40} className="rounded-lg" />
          <span className="font-display text-xl font-bold text-foreground">Bellum AI</span>
        </Link>
        <h1 className="font-display text-4xl font-bold text-foreground">404</h1>
        <p className="text-lg text-muted-foreground">Page introuvable</p>
        <p className="text-sm text-muted-foreground">
          La page que vous recherchez n’existe pas ou a été déplacée.
        </p>
        <Button
          size="lg"
          onClick={() => (user ? navigate("/dashboard") : navigate("/"))}
          className="mt-4"
        >
          {user ? "Retour au dashboard" : "Retour à l'accueil"}
        </Button>
      </div>
    </div>
  );
}
