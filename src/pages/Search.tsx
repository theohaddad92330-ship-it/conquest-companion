import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search as SearchIcon, Zap, CheckCircle, Loader2, Circle, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountCard } from "@/components/AccountCard";
import { SearchCorrectionBanner } from "@/components/SearchCorrectionBanner";
import { useToast } from "@/hooks/use-toast";
import { useAnalysisPolling } from "@/hooks/useAnalysisPolling";
import { useCompanySearch } from "@/hooks/useCompanySearch";

interface Step {
  label: string;
  status: "pending" | "running" | "done";
  duration?: string;
}

const initialSteps: Step[] = [
  { label: "Recherche web", status: "pending" },
  { label: "Données entreprise", status: "pending" },
  { label: "Analyse IA du compte", status: "pending" },
  { label: "Scraping LinkedIn", status: "pending" },
  { label: "Construction organigramme", status: "pending" },
  { label: "Enrichissement contacts", status: "pending" },
  { label: "Génération messages", status: "pending" },
];

const ESTIMATED_TOTAL_SECONDS = 120; // ~2 min pour les premières étapes

function formatTimeRemaining(elapsedSeconds: number, progress: number): string {
  const remaining = Math.max(0, ESTIMATED_TOTAL_SECONDS - elapsedSeconds);
  if (remaining <= 0 || progress >= 80) return "Quasi terminé…";
  if (remaining < 60) return `~${remaining} s restantes`;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return s ? `~${m} min ${s} s restantes` : `~${m} min restantes`;
}

const LOADING_MESSAGES = [
  "Nous traitons plus de 238 sources de données en même temps.",
  "Recherche web, analyse IA et enrichissement des contacts en cours.",
  "Ne fermez pas la page — la mise à jour est automatique toutes les 2 secondes.",
  "Les premières étapes (recherche + analyse) prennent en général 1 à 2 minutes.",
];

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { state: analysis, startAnalysis, resetState, resumeAnalysis } = useAnalysisPolling();
  const { suggestions, isSearching: isSuggesting, searchError, search: searchSuggestions, clear: clearSuggestions } = useCompanySearch();

  const isAnalyzingOrLoading = analysis.status === "loading" || analysis.status === "analyzing";
  useEffect(() => {
    if (!isAnalyzingOrLoading) {
      setElapsedSeconds(0);
      return;
    }
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isAnalyzingOrLoading]);
  useEffect(() => {
    if (analysis.status === "loading" && analysis.accountId) setElapsedSeconds(0);
  }, [analysis.status, analysis.accountId]);

  const steps = useMemo<Step[]>(() => {
    const base = initialSteps.map((s) => ({ ...s, status: "pending" as const, duration: undefined }));
    if (analysis.status === "idle") return base;
    if (analysis.status === "error") return base;

    const progress = analysis.progress || 0;
    const doneCount = progress >= 100 ? base.length : progress >= 80 ? 5 : progress >= 65 ? 4 : progress >= 40 ? 3 : progress >= 15 ? 1 : 0;
    const runningIndex = Math.min(doneCount, base.length - 1);

    return base.map((s, i) => {
      if (i < doneCount) return { ...s, status: "done" as const, duration: "—" };
      if (analysis.status === "loading" || analysis.status === "analyzing") {
        if (i === runningIndex) return { ...s, status: "running" as const };
      }
      return s;
    });
  }, [analysis.progress, analysis.status]);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    clearSuggestions();
    setBannerDismissed(false);
    await startAnalysis(trimmed);
  }, [query, startAnalysis, clearSuggestions]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    searchSuggestions(value);
  }, [searchSuggestions]);

  const handleSelectSuggestion = useCallback((name: string) => {
    setQuery(name);
    clearSuggestions();
    setBannerDismissed(false);
    startAnalysis(name);
  }, [startAnalysis, clearSuggestions]);

  const showCorrectionBanner = analysis.originalQuery && (analysis.correctedName || analysis.notFound) && !bannerDismissed;

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) { setQuery(q); }
  }, [searchParams]);

  // Reprendre l'affichage de l'avancement si une analyse était en cours (ex. retour depuis Mes comptes)
  useEffect(() => {
    resumeAnalysis();
  }, [resumeAnalysis]);

  // Ne pas afficher le toast d'erreur des suggestions pendant une analyse en cours (évite bandeau rouge parasite)
  const lastSearchErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!searchError) return;
    if (analysis.status === "loading" || analysis.status === "analyzing") return;
    if (lastSearchErrorRef.current === searchError) return;
    lastSearchErrorRef.current = searchError;
    toast({ title: "Recherche", description: searchError, variant: "destructive" });
  }, [searchError, analysis.status, toast]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q && analysis.status === "idle") { handleSearch(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };
  const isIdle = analysis.status === "idle";

  useEffect(() => {
    if (analysis.status === "completed" && analysis.accountId) {
      navigate(`/accounts/${analysis.accountId}`);
    }
  }, [analysis.status, analysis.accountId, navigate]);

  return (
    <div className="flex flex-col h-full">
      <div className={`flex flex-col items-center justify-center transition-all duration-500 ${isIdle ? "flex-1" : "pt-8 pb-6 px-6"}`}>
        <AnimatePresence mode="wait">
          {isIdle && (
            <motion.div key="hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-6">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Nouvelle recherche</span>
              </div>
              <h1 className="font-display text-3xl font-bold mb-3 md:text-4xl">
                Analysez n&apos;importe quel compte<br />
                <span className="text-gradient-bellum">en quelques secondes</span>
              </h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Entrez un nom d&apos;entreprise et obtenez une fiche compte enrichie avec enjeux IT, signaux récents et score de priorité.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`w-full ${isIdle ? "max-w-xl px-6" : "max-w-3xl"}`}>
          <div className="relative flex items-center gap-2">
            <div ref={inputWrapperRef} className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
              <Input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => query.trim().length >= 2 && searchSuggestions(query)}
                onBlur={() => setTimeout(clearSuggestions, 200)}
                placeholder="Entrez un nom d'entreprise (ex : Société Générale)"
                className="h-12 pl-10 pr-4 text-sm bg-card border-border focus-visible:ring-primary/50 search-glow"
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg z-20 max-h-60 overflow-auto">
                  {suggestions.map((s) => (
                    <button
                      key={s.siren || s.name}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 flex flex-col gap-0.5 border-b border-border last:border-0"
                      onClick={() => handleSelectSuggestion(s.name)}
                    >
                      <span className="font-medium text-sm text-foreground">{s.name}</span>
                      {(s.city || s.sector) && (
                        <span className="text-xs text-muted-foreground">{[s.city, s.sector].filter(Boolean).join(" · ")}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {isSuggesting && query.trim().length >= 2 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <Button onClick={handleSearch} disabled={!query.trim() || analysis.status === "loading"} size="lg" className="h-12 px-6 font-semibold btn-press">
              {analysis.status === "loading" || analysis.status === "analyzing" ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyse...
                </span>
              ) : "Analyser"}
            </Button>
          </div>
        </div>
      </div>

      {analysis.status === "error" && (
        <div className="flex-1 px-6 pb-8 max-w-3xl mx-auto w-full">
          <Card className="border-destructive/50">
            <CardContent className="p-5 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">L&apos;analyse a échoué</p>
              <p className="text-xs text-muted-foreground">{analysis.error || "Erreur inconnue. Veuillez réessayer."}</p>
              <Button variant="outline" size="sm" onClick={() => { setBannerDismissed(false); resetState(); }}>
                Nouvelle recherche
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <AnimatePresence>
        {(analysis.status === "loading" || analysis.status === "analyzing" || analysis.status === "completed") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 px-6 pb-8 max-w-3xl mx-auto w-full space-y-6">

            {showCorrectionBanner && (
              <SearchCorrectionBanner
                originalQuery={analysis.originalQuery!}
                correctedName={analysis.correctedName}
                notFound={analysis.notFound}
                suggestions={analysis.alternativeSuggestions}
                onSuggestionClick={handleSelectSuggestion}
                onDismiss={() => setBannerDismissed(true)}
              />
            )}

            {/* Progress steps */}
            {(analysis.status === "loading" || analysis.status === "analyzing") && (
              <Card className="border-border">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <p className="text-sm font-semibold">
                      {query} — {analysis.currentStep || "Analyse en cours..."}
                    </p>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full tabular-nums">
                      {formatTimeRemaining(elapsedSeconds, analysis.progress ?? 0)}
                    </span>
                  </div>
                  <ul className="text-xs text-muted-foreground mb-3 space-y-1 list-disc list-inside">
                    {LOADING_MESSAGES.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2.5">
                        {step.status === "done" && <CheckCircle className="h-4 w-4 text-bellum-success" />}
                        {step.status === "running" && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                        {step.status === "pending" && <Circle className="h-4 w-4 text-muted-foreground/40" />}
                        <span className={`text-sm ${step.status === "done" ? "text-foreground" : step.status === "running" ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {step.status === "done" && `Terminé — ${step.duration}`}
                        {step.status === "running" && "En cours..."}
                        {step.status === "pending" && "En attente"}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Skeleton blocks while loading */}
            {(analysis.status === "loading" || analysis.status === "analyzing") && (
              <div className="space-y-4">
                <Card className="border-border">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-40" />
                      {steps.filter(s => s.status === "done").length >= 2 && (
                        <span className="text-xs text-bellum-success">✅ PRÊT</span>
                      )}
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-5 w-32" />
                    <div className="flex gap-3">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Skeleton key={n} className="h-16 w-24 rounded-md" />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Identification des contacts en cours...</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Results */}
            {analysis.status === "completed" && analysis.account && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <AccountCard account={analysis.account} isLoading={false} />
                <div className="mt-4 text-center">
                  <Button variant="outline" onClick={() => navigate(`/accounts/${analysis.account!.id}`)}>
                    Voir la fiche complète →
                  </Button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
