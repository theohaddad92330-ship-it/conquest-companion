import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  Bell,
  Timer,
  RefreshCw,
  ArrowUpRight,
  MessageSquareText,
  Users,
  Target,
  Coins,
  Building2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/useAccounts";
import { useCredits } from "@/hooks/useCredits";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { safeString, cn } from "@/lib/utils";
import {
  getDashboardIntro,
  getSearchTip,
  getNextActionSectionTip,
  getQueueEmptyTip,
  getJarvisBonusTip,
} from "@/lib/personalized-copy";

const fadeUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

export default function Dashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { user } = useAuth();
  const { profile } = useProfile();
  const { accounts, isLoading: accountsLoading, error: accountsError, refetch: refetchAccounts } = useAccounts();
  const { credits: userCredits, usagePercent, remaining, isLoading: creditsLoading } = useCredits();
  const safeAccounts = accountsError ? [] : (Array.isArray(accounts) ? accounts : []);
  const firstName = profile?.full_name?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || user?.user_metadata?.name?.split(" ")[0] || "";

  const sortedAccounts = useMemo(() => {
    return [...safeAccounts].sort(
      (a: any, b: any) => new Date(b.created_at ?? b.createdAt).getTime() - new Date(a.created_at ?? a.createdAt).getTime()
    );
  }, [safeAccounts]);

  const onboarding = (profile?.onboarding_data ?? {}) as any;
  const userOffers = Array.isArray(onboarding.offers) ? onboarding.offers.slice(0, 6) : [];
  const userSectors = Array.isArray(onboarding.sectors) ? onboarding.sectors.slice(0, 8) : [];
  const userPersonas = Array.isArray(onboarding.personas) ? onboarding.personas.slice(0, 8) : [];
  const userGeo = Array.isArray(onboarding.geo) ? onboarding.geo.slice(0, 6) : [];
  const userSize = safeString(onboarding.size);

  function accountContactsCount(a: any) {
    if (typeof (a as any).contact_count === "number") return (a as any).contact_count;
    const rawContacts = a?.raw_analysis?.contacts;
    if (Array.isArray(rawContacts)) return rawContacts.length;
    return 0;
  }

  function accountMessagesCount(a: any) {
    const rawContacts = a?.raw_analysis?.contacts;
    if (!Array.isArray(rawContacts)) return 0;
    return rawContacts.reduce((sum: number, c: any) => {
      return (
        sum +
        (c?.emailMessage ? 1 : 0) +
        (c?.linkedinMessage ? 1 : 0) +
        (c?.followupMessage ? 1 : 0)
      );
    }, 0);
  }

  function accountSignalsCount(a: any) {
    const rs = a?.recent_signals;
    return Array.isArray(rs) ? rs.length : 0;
  }

  function inPerimeter(a: any) {
    if (userSectors.length === 0) return true;
    const s = String(a?.sector ?? "").toLowerCase();
    return userSectors.some((x: any) => String(x).toLowerCase() === s);
  }

  const statusStats = useMemo(() => {
    const total = safeAccounts.length || 1;
    const completed = safeAccounts.filter((a: any) => a.status === "completed").length;
    const analyzing = safeAccounts.filter((a: any) => a.status === "analyzing").length;
    const errored = safeAccounts.filter((a: any) => a.status === "error").length;
    const high = safeAccounts.filter((a: any) => (a.priority_score ?? 0) >= 8).length;
    const medium = safeAccounts.filter((a: any) => (a.priority_score ?? 0) >= 5 && (a.priority_score ?? 0) <= 7).length;
    const low = Math.max(0, safeAccounts.length - high - medium);
    return {
      total,
      completed,
      analyzing,
      errored,
      high,
      medium,
      low,
      completedPct: Math.round((completed / total) * 100),
    };
  }, [safeAccounts]);

  const decisionInbox = useMemo(() => {
    // "Actualités" = signaux déjà stockés en DB (recent_signals)
    const items: { accountId: string; company: string; score: number; signal: string }[] = [];
    for (const a of sortedAccounts) {
      const signals = Array.isArray(a.recent_signals) ? a.recent_signals : [];
      const score = Number(a.priority_score ?? a.priorityScore ?? 0) || 0;
      const company = a.company_name ?? a.companyName ?? "Compte";
      for (const s of signals.slice(0, 6)) {
        const txt = typeof s === "string" ? s : JSON.stringify(s);
        if (!txt) continue;
        items.push({ accountId: a.id, company, score, signal: txt });
      }
    }
    // Dédoublonnage simple par texte (éviter l'effet spam)
    const seen = new Set<string>();
    const deduped: typeof items = [];
    for (const it of items.sort((x, y) => y.score - x.score)) {
      const key = it.signal.toLowerCase().slice(0, 220);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(it);
      if (deduped.length >= 12) break;
    }
    return deduped;
  }, [sortedAccounts]);

  const nextActions = useMemo(() => {
    const analyzing = sortedAccounts.filter((a: any) => a.status === "analyzing").slice(0, 4);
    const errored = sortedAccounts.filter((a: any) => a.status === "error").slice(0, 4);
    const topPriority = sortedAccounts
      .filter((a: any) => a.status === "completed")
      .sort((a: any, b: any) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
      .slice(0, 4);
    return { analyzing, errored, topPriority };
  }, [sortedAccounts]);

  const cockpit = useMemo(() => {
    const inScope = sortedAccounts.filter(inPerimeter);
    const completed = inScope.filter((a: any) => a.status === "completed");
    const withContacts = completed.filter((a: any) => accountContactsCount(a) > 0);
    const withMessages = completed.filter((a: any) => accountMessagesCount(a) > 0);

    const actionQueue = completed
      .map((a: any) => {
        const score = Number(a.priority_score ?? a.priorityScore ?? 0) || 0;
        const contacts = accountContactsCount(a);
        const messages = accountMessagesCount(a);
        const signals = accountSignalsCount(a);
        let next = "Ouvrir la fiche";
        let why = "Revoir le plan et prioriser vos angles.";
        let level: "high" | "med" | "low" = score >= 8 ? "high" : score >= 5 ? "med" : "low";
        if (contacts === 0) {
          next = "Trouver des contacts exploitables";
          why = "Sans contacts, impossible d’envoyer des messages ou de planifier des relances.";
        } else if (messages === 0) {
          next = "Générer / récupérer des messages";
          why = "Vous avez des contacts mais pas de messages prêts à l’envoi.";
        } else if (signals === 0) {
          next = "Ajouter un signal d’entrée";
          why = "Sans signal, l’accroche est moins crédible. Chercher une nomination/projet/budget.";
        } else if (score >= 8) {
          next = "Lancer la séquence";
          why = "Score haut + signaux : c’est le meilleur moment pour agir.";
        }
        return {
          id: a.id,
          company: a.company_name ?? a.companyName ?? "Compte",
          sector: a.sector || "—",
          score,
          contacts,
          messages,
          signals,
          level,
          next,
          why,
          createdAt: a.created_at ?? a.createdAt,
        };
      })
      .sort((a: any, b: any) => (b.score - a.score) || (b.signals - a.signals) || (b.contacts - a.contacts))
      .slice(0, 8);

    const readyToday = actionQueue.filter((x: any) => x.next === "Lancer la séquence").slice(0, 3);
    return {
      inScopeTotal: inScope.length,
      completed: completed.length,
      withContacts: withContacts.length,
      withMessages: withMessages.length,
      actionQueue,
      readyToday,
    };
  }, [sortedAccounts, userSectors]);

  const handleSearch = () => {
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const hasAccounts = safeAccounts.length > 0;
  const creditUsed = userCredits?.accounts_used ?? 0;
  const creditTotal = userCredits?.accounts_limit ?? 3;

  if (accountsLoading || creditsLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {accountsError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">Impossible de charger la liste des comptes.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => typeof refetchAccounts === "function" && refetchAccounts()}>Réessayer</Button>
          </CardContent>
        </Card>
      )}
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* Header */}
        <motion.div variants={fadeUp} className="header-premium mb-4 flex items-start justify-between rounded-xl px-5 py-4 gap-4 flex-wrap">
          <div className="min-w-[260px]">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
              <h1 className="font-display text-2xl font-bold">Tableau de bord{firstName ? ` — ${firstName}` : ""}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {getDashboardIntro(firstName, onboarding)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 border border-border bg-muted text-muted-foreground text-xs font-medium">
              <Sparkles className="h-3 w-3" />
              Plan {String(userCredits?.plan ?? "starter").toLowerCase()}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => navigate("/billing")} className="gap-2">
              <Coins className="h-4 w-4 text-muted-foreground" />
              Crédits : {Math.max(0, remaining)} / {creditTotal}
            </Button>
          </div>
        </motion.div>

        {/* Search bar */}
        <motion.div variants={fadeUp} className="mb-6">
          <Card className="border-border bg-card overflow-hidden card-neutral rounded-xl">
            <CardContent className="p-5">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Rechercher un compte... Ex : Société Générale, Airbus, SNCF"
                    className="h-12 pl-11 text-sm bg-secondary/50 border-border focus-visible:ring-primary/50 search-glow"
                  />
                </div>
                <Button onClick={handleSearch} className="h-12 px-6 btn-press">
                  Analyser
                </Button>
              </div>
              <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-muted-foreground">
                  {getSearchTip(onboarding)}
                </p>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate("/accounts")}>
                  Voir mon portefeuille <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pilotage : 3 KPIs uniquement — pas de copier-coller des autres pages */}
        <motion.div variants={fadeUp} className="grid gap-4 md:grid-cols-3 mb-6">
          <Card className="border-border card-neutral rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prêts à lancer</p>
                  <p className="text-2xl font-bold mt-1">{cockpit.readyToday.length > 0 ? cockpit.readyToday.length : statusStats.high}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cockpit.readyToday.length > 0 ? "comptes score 8+ avec contacts" : "comptes priorité haute (8–10)"}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-bellum-success/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-bellum-success" />
                </div>
              </div>
              {statusStats.completed > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  {statusStats.completed} analysés · {statusStats.analyzing} en cours
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="border-border card-neutral rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">À traiter</p>
                  <p className="text-2xl font-bold mt-1">{statusStats.analyzing + statusStats.errored}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {statusStats.analyzing} en cours · {statusStats.errored} en erreur
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                  <Timer className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              {statusStats.errored > 0 && (
                <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => navigate("/accounts")}>
                  Relancer les analyses <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>
          <Card className="border-border card-neutral rounded-xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Crédits</p>
                  <p className="text-2xl font-bold mt-1">{Math.max(0, remaining)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">analyses restantes ce mois</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                  <Coins className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              <Progress value={usagePercent} className="mt-3 h-2" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Decision cockpit: actions + inbox */}
        {hasAccounts && (
          <motion.div variants={fadeUp} className="grid gap-4 lg:grid-cols-3 mb-6">
            <Card className="border-border card-neutral rounded-xl lg:col-span-1">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    À faire maintenant
                  </h3>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate("/search")}>
                    Nouvelle analyse <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                    {getNextActionSectionTip(firstName, nextActions.analyzing.length > 0, nextActions.errored.length > 0)}
                  </p>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">En cours</p>
                    {nextActions.analyzing.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {nextActions.analyzing.map((a: any) => (
                          <button key={a.id} className="w-full text-left text-sm hover:underline" onClick={() => navigate(`/accounts/${a.id}`)}>
                            {a.company_name ?? a.companyName} <span className="text-xs text-muted-foreground">— analyse en cours</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">Aucune analyse en cours.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">À relancer</p>
                    {nextActions.errored.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {nextActions.errored.map((a: any) => (
                          <div key={a.id} className="flex items-center justify-between gap-3">
                            <button className="text-left text-sm hover:underline" onClick={() => navigate(`/accounts/${a.id}`)}>
                              {a.company_name ?? a.companyName}
                            </button>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => navigate(`/accounts/${a.id}`)}>
                              <RefreshCw className="h-3.5 w-3.5 mr-1" />
                              Ouvrir
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">Aucun compte en erreur.</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top priorités</p>
                    {nextActions.topPriority.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {nextActions.topPriority.map((a: any) => (
                          <div key={a.id} className="flex items-center justify-between gap-3">
                            <button className="text-left text-sm hover:underline" onClick={() => navigate(`/accounts/${a.id}`)}>
                              {a.company_name ?? a.companyName}
                            </button>
                            <PriorityBadge score={a.priority_score ?? a.priorityScore ?? 0} size="sm" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1">Aucun compte prêt pour l’instant.</p>
                    )}
                  </div>
                  {getJarvisBonusTip(onboarding) && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 mt-3">
                      <p className="text-xs text-foreground/90 leading-relaxed italic">
                        {getJarvisBonusTip(onboarding)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border card-neutral rounded-xl lg:col-span-2">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    Signaux à ne pas rater
                  </h3>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/accounts")}>
                    Voir mes comptes <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                {decisionInbox.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
                    <p className="text-sm text-muted-foreground">Aucun signal détecté pour l’instant.</p>
                    <p className="text-xs text-muted-foreground mt-1">Lancez une analyse : les signaux (nominations, projets, budgets) apparaîtront ici.</p>
                  </div>
                ) : (
                  <div className="table-premium-wrapper">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-semibold">Compte</TableHead>
                          <TableHead className="text-xs font-semibold w-24">Score</TableHead>
                          <TableHead className="text-xs font-semibold">Signal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {decisionInbox.slice(0, 3).map((it, idx) => (
                          <TableRow
                            key={`${it.accountId}-${idx}`}
                            className="table-row-hover cursor-pointer"
                            onClick={() => navigate(`/accounts/${it.accountId}`)}
                          >
                            <TableCell className="font-medium flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary">
                                <Building2 className="h-3.5 w-3.5 text-foreground/60" />
                              </div>
                              {it.company}
                            </TableCell>
                            <TableCell>
                              <PriorityBadge score={it.score} size="sm" />
                            </TableCell>
                            <TableCell className="text-sm text-foreground/80">{it.signal}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Un seul CTA portefeuille */}
        <motion.div variants={fadeUp}>
          {hasAccounts ? (
            <Card className="border-border card-neutral rounded-xl">
              <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Portefeuille · {statusStats.total} compte{statusStats.total > 1 ? "s" : ""}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {statusStats.completed} prêts · {statusStats.analyzing} en cours
                    {statusStats.errored > 0 ? ` · ${statusStats.errored} en erreur` : ""}
                  </p>
                </div>
                <Button variant="outline" onClick={() => navigate("/accounts")} className="gap-2">
                  Voir tout mon portefeuille <ArrowUpRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <EmptyState type="accounts" />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
