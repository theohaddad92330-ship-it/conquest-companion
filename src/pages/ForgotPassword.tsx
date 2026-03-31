import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BellumLogo } from "@/components/BellumLogo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <Card className="w-full max-w-sm border-border">
          <CardContent className="p-8 space-y-6 text-center">
            <div className="mx-auto">
              <BellumLogo size={48} className="rounded-xl" />
            </div>
            <h1 className="font-display text-xl font-bold">C&apos;est envoyé</h1>
            <p className="text-sm text-muted-foreground">
              Si un compte existe avec l'adresse <strong>{email}</strong>, vous recevrez un lien de réinitialisation.
            </p>
            <Link to="/login" className="text-sm text-primary hover:underline font-medium">
              ← Retour à la connexion
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <Card className="w-full max-w-sm border-border">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <BellumLogo size={36} className="rounded-lg" />
              <span className="font-display text-xl font-bold">Bellum AI</span>
            </Link>
            <h1 className="font-display text-2xl font-bold">Mot de passe oublié</h1>
            <p className="text-sm text-muted-foreground">On vous envoie un lien. Vous choisissez un nouveau mot de passe.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" placeholder="john@esn.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading || !email}>
              {loading ? "Envoi…" : "Envoyer le lien"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline font-medium">← Retour à la connexion</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
