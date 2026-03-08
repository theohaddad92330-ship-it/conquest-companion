import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/hooks/useProfile";

const steps = [
  { question: "Quel est le nom de votre ESN ?", type: "input" as const, placeholder: "Ex : Capgemini, Alten, Devoteam", key: "esnName", required: true },
  { question: "Combien de consultants avez-vous ?", type: "radio" as const, options: ["1 - 20 consultants", "20 - 50 consultants", "50 - 200 consultants", "200+ consultants"], key: "size", required: true },
  { question: "Quelles sont vos offres principales ?", subtitle: "Sélectionnez toutes celles qui s'appliquent", type: "chips" as const, options: ["Développement", "Data & IA", "Cloud & DevOps", "Cybersécurité", "Infrastructure", "Conseil SI", "SAP / ERP", "UX / Product", "Agilité / PMO"], key: "offers", required: true },
  { question: "Quels secteurs visez-vous en priorité ?", subtitle: "Sélectionnez jusqu'à 5", type: "chips" as const, options: ["Banque-Assurance", "Industrie", "Retail", "Secteur Public", "Énergie", "Telecom", "Santé-Pharma", "Transport"], key: "sectors", required: true },
  { question: "Quel type de client ciblez-vous ?", type: "checkbox" as const, options: ["Grands comptes (CAC40, SBF120)", "ETI (500 - 5000 salariés)", "PME (< 500 salariés)"], key: "clientType", required: true },
  { question: "Qui sont vos interlocuteurs habituels ?", subtitle: "Sélectionnez les personas que vous ciblez", type: "chips" as const, options: ["DSI / CTO", "Directeur de projet", "DAF", "Achats IT", "DRH", "Opérationnels IT", "CDO / Data", "RSSI / Cyber"], key: "personas", required: true },
  { question: "Quelle est votre zone géographique ?", type: "checkbox" as const, options: ["Île-de-France", "Régions (France)", "International"], key: "geo", required: true },
  { question: "Avez-vous déjà des référencements actifs ?", subtitle: "Bellum exclura ces comptes de vos suggestions de prospection", type: "chips" as const, options: ["Oui, sur des grands comptes", "Oui, sur des ETI", "Non, nous partons de zéro", "Quelques-uns, en cours de renouvellement"], key: "existingRefs", required: true },
  { question: "Quel est votre cycle de vente moyen ?", subtitle: "Cela permet d'adapter le plan d'action à votre rythme", type: "radio" as const, options: ["Moins de 3 mois", "3 à 6 mois", "6 à 12 mois", "Plus de 12 mois"], key: "salesCycle", required: true },
  { question: "Quel est votre TJM moyen ?", subtitle: "Pour calibrer les angles d'attaque et le positionnement prix", type: "radio" as const, options: ["Moins de 400€", "400€ - 600€", "600€ - 900€", "900€+"], key: "avgTJM", required: true },
  { question: "Combien de commerciaux dans votre équipe ?", subtitle: "Pour adapter les volumes et le rythme de prospection recommandé", type: "radio" as const, options: ["Je suis seul(e)", "2 - 5 commerciaux", "5 - 15 commerciaux", "15+ commerciaux"], key: "salesTeamSize", required: true },
  { question: "Quel est votre principal défi commercial ?", subtitle: "Bellum priorisera les recommandations selon votre besoin", type: "radio" as const, options: ["Identifier de nouveaux comptes à prospecter", "Trouver les bons interlocuteurs sur des comptes connus", "Rédiger des messages qui convertissent", "Structurer mon approche plan de compte"], key: "mainChallenge", required: true },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { updateProfile, refetch: refetchProfile } = useProfile();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);
  const isLast = current === steps.length - 1;

  const step = steps[current];

  const setAnswer = (key: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setShowError(false);
  };

  const toggleChip = (key: string, value: string) => {
    const arr: string[] = answers[key] || [];
    setAnswer(key, arr.includes(value) ? arr.filter((v: string) => v !== value) : [...arr, value]);
  };

  const isStepValid = () => {
    const val = answers[step.key];
    if (step.type === "input") return val && val.trim().length > 0;
    if (step.type === "radio") return !!val;
    if (step.type === "chips" || step.type === "checkbox") return Array.isArray(val) && val.length > 0;
    return true;
  };

  const saveOnboarding = async (): Promise<boolean> => {
    setSaving(true);
    try {
      const payload = {
        onboarding_completed: true,
        onboarding_data: answers as any,
        company_name: answers.esnName || null,
      };
      const { error, data } = await updateProfile(payload);
      if (error) {
        console.error("[Onboarding] Erreur sauvegarde profil:", error);
        toast({ title: "Erreur", description: "Impossible de sauvegarder votre profil. Réessaie.", variant: "destructive" });
        return false;
      }
      console.log("[Onboarding] Sauvegarde OK — onboarding_completed: true", data);
      return true;
    } catch (err) {
      console.error("[Onboarding] saveOnboarding error:", err);
      toast({ title: "Erreur", description: "Erreur lors de la sauvegarde. Réessaie.", variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (!isStepValid()) {
      setShowError(true);
      toast({ title: "Réponse requise", description: "Veuillez répondre à cette question avant de continuer.", variant: "destructive" });
      return;
    }
    setShowError(false);

    if (isLast) {
      try {
        const saved = await saveOnboarding();
        if (saved) {
          await refetchProfile();
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        console.error("[Onboarding] Submit final error:", err);
        toast({ title: "Erreur", description: "Erreur lors de la sauvegarde. Réessaie.", variant: "destructive" });
      }
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const prev = () => {
    setShowError(false);
    setCurrent((c) => Math.max(c - 1, 0));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-1 mb-2">
        {steps.map((_, i) => (
          <div key={i} className={`h-2 rounded-full transition-colors ${i <= current ? "bg-primary" : "bg-secondary"}`} style={{ width: `${Math.max(100 / steps.length, 16)}px` }} />
        ))}
      </div>
      <p className="text-xs text-foreground/40 mb-10">Étape {current + 1} sur {steps.length}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-lg text-center space-y-8"
        >
          <div>
            <h1 className="font-display text-2xl font-bold mb-2">{step.question}</h1>
            {step.subtitle && <p className="text-sm text-foreground/50">{step.subtitle}</p>}
          </div>

          <div className="space-y-3">
            {step.type === "input" && (
              <div>
                <Input
                  className={`h-12 text-center text-base ${showError && !isStepValid() ? "border-destructive" : ""}`}
                  placeholder={step.placeholder}
                  value={answers[step.key] || ""}
                  onChange={(e) => setAnswer(step.key, e.target.value)}
                  autoFocus
                />
                {showError && !isStepValid() && (
                  <p className="text-xs text-destructive mt-2 flex items-center justify-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Ce champ est obligatoire
                  </p>
                )}
              </div>
            )}

            {step.type === "radio" && step.options?.map((opt) => (
              <button
                key={opt}
                onClick={() => setAnswer(step.key, opt)}
                className={`w-full p-4 rounded-lg border text-sm text-left transition-colors ${
                  answers[step.key] === opt
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-foreground/60 hover:bg-secondary"
                }`}
              >
                {opt}
              </button>
            ))}

            {step.type === "chips" && (
              <div className="flex flex-wrap justify-center gap-2">
                {step.options?.map((opt) => {
                  const selected = (answers[step.key] || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => toggleChip(step.key, opt)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border bg-card text-foreground/60 hover:bg-secondary"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {step.type === "checkbox" && step.options?.map((opt) => {
              const arr: string[] = answers[step.key] || [];
              const checked = arr.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggleChip(step.key, opt)}
                  className={`w-full p-4 rounded-lg border text-sm text-left transition-colors flex items-center gap-3 ${
                    checked
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-foreground/60 hover:bg-secondary"
                  }`}
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center ${checked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                    {checked && <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  {opt}
                </button>
              );
            })}

            {showError && !isStepValid() && step.type !== "input" && (
              <p className="text-xs text-destructive flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" /> Veuillez sélectionner au moins une option
              </p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center gap-4 mt-10">
        {current > 0 && (
          <Button variant="ghost" size="sm" onClick={prev}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Précédent
          </Button>
        )}
        <Button onClick={next} size="sm" disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sauvegarde…</>
          ) : isLast ? "Terminer" : "Suivant"}
          {!saving && <ArrowRight className="h-4 w-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}
