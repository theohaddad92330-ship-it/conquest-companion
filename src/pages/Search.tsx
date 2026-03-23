import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search as SearchIcon,
  CheckCircle,
  Loader2,
  Circle,
  AlertTriangle,
  Crosshair,
  Radio,
  MapPin,
  DoorOpen,
  Building2,
  UserCircle,
  MessageSquare,
  Check,
} from "lucide-react";
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
import { useCancelAnalysis } from "@/hooks/useAccounts";

interface Step {
  label: string;
  status: "pending" | "running" | "done";
  duration?: string;
}

const initialSteps: Step[] = [
  { label: "Bellum analyse le périmètre et les signaux", status: "pending" },
  { label: "Croisement des sources et tri de l’info utile", status: "pending" },
  { label: "Construction de la fiche compte", status: "pending" },
  { label: "Identification des décideurs et portes d'entrée", status: "pending" },
  { label: "Organisation par entité et chaîne de décision", status: "pending" },
  { label: "Enrichissement des profils (contacts & messages)", status: "pending" },
  { label: "Préparation des messages personnalisés", status: "pending" },
];

const ESTIMATED_TOTAL_SECONDS = 120;
const MAX_ANALYSIS_SECONDS = 8 * 60; // 8 min — au-delà le backend interrompt

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}

function formatTimeRemaining(elapsedSeconds: number, progress: number): string {
  const remaining = Math.max(0, ESTIMATED_TOTAL_SECONDS - elapsedSeconds);
  if (progress >= 80) return "Quasi terminé…";
  if (remaining <= 0) return "En cours…";
  if (remaining < 60) return `~${remaining} s restantes`;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return s ? `~${m} min ${s} s restantes` : `~${m} min restantes`;
}

const LOADING_MESSAGES = [
  "On rassemble le contexte utile pour éviter 2 heures de recherche.",
  "On prépare la fiche et les signaux que vous pourrez citer.",
  "On cherche des portes d’entrée par entité.",
  "Laissez la page ouverte. La mise à jour se fait toute seule.",
];

const CONTACTS_PHASE_ESTIMATE_MIN = 5;
const REASSURANCE_INTERVAL_SEC = 30;

const AGENT_ACTIVITY_SOURCES: { icon: string; label: string }[] = [
  { icon: "scope", label: "Analyse du périmètre cible" },
  { icon: "signal", label: "Croisement des signaux récents" },
  { icon: "map", label: "Cartographie des décideurs" },
  { icon: "door", label: "Portes d'entrée" },
  { icon: "entity", label: "Structuration par entité" },
  { icon: "profile", label: "Enrichissement des profils" },
  { icon: "message", label: "Préparation des messages" },
  { icon: "check", label: "Vérification de cohérence" },
];

const AGENT_LOADING_PHRASES = [
  "Bellum croise les informations pour une vision à 360° du compte.",
  "L'agent identifie les signaux utiles à citer en premier contact.",
  "Construction de la fiche et des angles d'attaque à partir des données recueillies.",
  "Identification des décideurs et des portes d'entrée par entité.",
  "Enrichissement des profils et préparation des messages personnalisés.",
  "Vous pouvez quitter la page : la mise à jour se fera automatiquement.",
  "Plusieurs sources sont analysées en parallèle pour maximiser la pertinence.",
  "L'agent priorise les informations actionnables pour votre prospection.",
];

const REASSURANCE_POPUPS = [
  "Pas de panique : on enrichit tout. Vous pouvez quitter la page en attendant.",
  "Phase contacts & messages en cours (~5 min). Bellum prépare tout pour vous.",
  "Enrichissement des profils en cours. Rien à faire, l'agent s'en occupe.",
  "Vous pouvez aller prendre un café : la mise à jour se fera automatiquement.",
  "Les messages personnalisés sont en cours de préparation. Patience.",
];

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function ActivityIcon({ name }: { name: string }) {
  const cls = "h-4 w-4 text-muted-foreground shrink-0";
  switch (name) {
    case "scope": return <Crosshair className={cls} />;
    case "signal": return <Radio className={cls} />;
    case "map": return <MapPin className={cls} />;
    case "door": return <DoorOpen className={cls} />;
    case "entity": return <Building2 className={cls} />;
    case "profile": return <UserCircle className={cls} />;
    case "message": return <MessageSquare className={cls} />;
    case "check": return <Check className={cls} />;
    default: return <Loader2 className={cls} />;
  }
}

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { state: analysis, startAnalysis, resetState, resumeAnalysis, stopPolling } = useAnalysisPolling();
  const cancelAnalysis = useCancelAnalysis();
  const { suggestions, isSearching: isSuggesting, searchError, searchWarning, search: searchSuggestions, clear: clearSuggestions } = useCompanySearch();

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

  const shuffledSources = useMemo(
    () => (isAnalyzingOrLoading && analysis.accountId ? shuffle(AGENT_ACTIVITY_SOURCES) : AGENT_ACTIVITY_SOURCES),
    [isAnalyzingOrLoading, analysis.accountId]
  );
  const currentPhraseIndex = Math.floor(elapsedSeconds / 10) % AGENT_LOADING_PHRASES.length;
  const isContactsPhase = isAnalyzingOrLoading && (analysis.progress >= 40 || elapsedSeconds >= 90);
  const lastReassuranceRef = useRef(0);
  useEffect(() => {
    if (!analysis.accountId) return;
    lastReassuranceRef.current = 0;
  }, [analysis.accountId]);
  useEffect(() => {
    if (!isContactsPhase || !analysis.accountId) return;
    const slot = Math.floor(elapsedSeconds / REASSURANCE_INTERVAL_SEC);
    if (slot > 0 && slot > lastReassuranceRef.current) {
      lastReassuranceRef.current = slot;
      const msg = REASSURANCE_POPUPS[(slot - 1) % REASSURANCE_POPUPS.length];
      toast({ title: "Bellum travaille", description: msg, duration: 6000 });
    }
  }, [isContactsPhase, elapsedSeconds, analysis.accountId, toast]);

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
          {query.trim().length >= 2 && !isSuggesting && suggestions.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {searchWarning || "Aucun résultat de suggestion. Tapez le nom exact et lancez l'analyse directement."}
            </p>
          )}
        </div>
      </div>

      {analysis.status === "error" && (
        <div className="flex-1 px-6 pb-8 max-w-3xl mx-auto w-full">
          <Card className="border-destructive/50">
            <CardContent className="p-5 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">L&apos;analyse a échoué</p>
              <p className="text-xs text-muted-foreground">{analysis.error || "Erreur inconnue. Veuillez réessayer."}</p>
              <p className="text-xs text-muted-foreground/80 pt-1 border-t border-border mt-3">Conseil : vérifiez le nom de l&apos;entreprise (orthographe, nom officiel) ou réessayez dans quelques instants.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => { setBannerDismissed(false); resetState(); }}>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      {isContactsPhase && (
                        <span className="text-xs font-medium text-primary bg-primary/15 px-2.5 py-1 rounded-full">
                          Contacts & messages — ~{CONTACTS_PHASE_ESTIMATE_MIN} min
                        </span>
                      )}
                      <span className="text-xs font-medium text-muted-foreground tabular-nums" title="Temps écoulé">
                        Écoulé : {formatElapsed(elapsedSeconds)}
                      </span>
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full tabular-nums">
                        {formatTimeRemaining(elapsedSeconds, analysis.progress ?? 0)}
                      </span>
                      {elapsedSeconds >= 4 * 60 && elapsedSeconds < MAX_ANALYSIS_SECONDS && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                          Peut prendre jusqu’à 8 min — au-delà l’analyse s’arrête automatiquement.
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        onClick={async (e) => {
                          e.preventDefault();
                          if (!analysis.accountId) return;
                          try {
                            await cancelAnalysis(analysis.accountId);
                            stopPolling();
                            resetState();
                            toast({ title: "Analyse arrêtée", description: "L'analyse a été interrompue." });
                          } catch {
                            toast({ title: "Erreur", description: "Impossible d'arrêter l'analyse.", variant: "destructive" });
                          }
                        }}
                      >
                        Arrêter l'analyse
                      </Button>
                    </div>
                  </div>
                  <div className="border-b border-border bg-muted/30 px-4 py-3 -mx-5 -mt-2 mb-3">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-xs font-medium text-muted-foreground shrink-0">Activité</span>
                      <div className="flex items-center gap-4 min-w-0 flex-1 overflow-x-auto scrollbar-thin py-1">
                        {shuffledSources.map((src, i) => (
                          <motion.div
                            key={`${src.icon}-${i}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.25 }}
                            className="flex items-center gap-2 shrink-0 rounded-md bg-background/80 px-2.5 py-1.5 border border-border/60"
                          >
                            <ActivityIcon name={src.icon} />
                            <span className="text-xs text-foreground/90 whitespace-nowrap">{src.label}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2.5 italic">
                      {AGENT_LOADING_PHRASES[currentPhraseIndex]}
                    </p>
                  </div>
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
                    <p className="text-xs text-muted-foreground">Bellum enrichit les profils et prépare les messages...</p>
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
