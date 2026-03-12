import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ClipboardList, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { BellumLogo } from "@/components/BellumLogo";

export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] 
    || user?.user_metadata?.name?.split(" ")[0] 
    || "là";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5 }}
        className="text-center max-w-lg space-y-8"
      >
        {/* Logo */}
        <div className="flex justify-center">
          <BellumLogo size={56} className="rounded-2xl" />
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-bold">
            Bienvenue, {firstName} ! 🎉
          </h1>
          <p className="text-foreground/60 text-lg">
            Votre compte Bellum AI est prêt. Remplissez ce questionnaire (environ 2 minutes) pour personnaliser votre expérience.
          </p>
        </div>

        {/* What's next */}
        <div className="bg-card border border-border rounded-xl p-6 text-left space-y-4">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-foreground/40">
            Et maintenant ?
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardList className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Un questionnaire rapide (~2 min)</p>
                <p className="text-xs text-foreground/50">
                  Pour personnaliser vos résultats : offres, secteurs, cibles, positionnement.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Bellum s'adapte à vous</p>
                <p className="text-xs text-foreground/50">
                  Plus vos réponses sont précises, meilleurs seront les plans de comptes, les contacts suggérés et les angles d'attaque.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Accès immédiat après</p>
                <p className="text-xs text-foreground/50">
                  Votre dashboard personnalisé sera prêt dès la fin du questionnaire.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Button size="lg" className="h-12 px-8 w-full" onClick={() => navigate("/onboarding")}>
          Commencer le questionnaire <ArrowRight className="h-4 w-4 ml-2" />
        </Button>

        <p className="text-xs text-foreground/30">
          Vous pourrez modifier vos réponses à tout moment depuis les paramètres.
        </p>
      </motion.div>
    </div>
  );
}
