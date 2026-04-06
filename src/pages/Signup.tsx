import { Link, useNavigate } from "react-router-dom";
import { BellumLogo } from "@/components/BellumLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast({ title: "Champs requis", description: "Veuillez remplir tous les champs.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Mot de passe trop court", description: "Le mot de passe doit contenir au moins 6 caractères.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error, session } = await signUp(email, password, name);
    setLoading(false);
    if (error) {
      const errMsg = (error as Error).message ?? "";
      const alreadyRegistered =
        errMsg.includes("already registered") || errMsg.includes("User already registered");
      if (alreadyRegistered) {
        toast({
          title: "Compte existant",
          description: "Un compte existe déjà avec cet email. Connectez-vous.",
          variant: "destructive",
          action: (
            <ToastAction altText="Aller à la connexion" onClick={() => navigate("/login")}>
              Se connecter
            </ToastAction>
          ),
        });
      } else {
        toast({ title: "Erreur d'inscription", description: errMsg || "Une erreur est survenue.", variant: "destructive" });
      }
    } else if (session) {
      // Session créée → page de bienvenue puis questionnaire
      navigate("/welcome", { replace: true });
    } else {
      toast({
        title: "Vérifiez votre email",
        description: "Un lien de confirmation a été envoyé. Cliquez dessus pour activer votre compte.",
        variant: "default",
      });
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);
    if (error) {
      toast({
        title: "Connexion Google",
        description: "La connexion Google n'est pas encore disponible. Utilisez votre email.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <Card className="w-full max-w-sm glass-card">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <BellumLogo size={36} className="rounded-lg" />
              <span className="font-display text-xl font-bold">Bellum AI</span>
            </Link>
            <h1 className="font-display text-2xl font-bold">Créer mon compte</h1>
            <p className="text-sm text-muted-foreground">3 comptes à tester. Pas de carte bancaire.</p>
          </div>

          <Button variant="outline" className="w-full h-11 gap-2" onClick={handleGoogle} disabled={loading}>
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            S'inscrire avec Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">ou</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nom complet</label>
              <Input placeholder="Jean Dupont" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email professionnel</label>
              <Input type="email" placeholder="jean@monesn.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mot de passe</label>
              <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
              <label className="text-xs text-muted-foreground">
                J'accepte les <Link to="/terms" className="text-primary hover:underline">CGV</Link> et la <Link to="/privacy" className="text-primary hover:underline">politique de confidentialité</Link>
              </label>
            </div>
            <Button type="submit" className="w-full h-11" disabled={!accepted || loading}>
              {loading ? "Création…" : "Créer mon compte"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Se connecter</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
