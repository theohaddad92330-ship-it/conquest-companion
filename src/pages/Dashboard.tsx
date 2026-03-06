import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  BarChart3,
  Users,
  Mail,
  Coins,
  ArrowRight,
  Building2,
  Calendar,
  TrendingUp,
  Zap,
  Target,
  Sparkles,
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
import { useAccounts } from "@/hooks/useAccounts";
import { useCredits } from "@/hooks/useCredits";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Tooltip,
} from "recharts";

const fadeUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

export default function Dashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { user } = useAuth();
  const { profile } = useProfile();
  const { accounts } = useAccounts();
  const { credits: userCredits, usagePercent, remaining } = useCredits();
  const firstName = profile?.full_name?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || user?.user_metadata?.name?.split(" ")[0] || "";

  const handleSearch = () => {
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const hasAccounts = accounts.length > 0;

  const creditUsed = userCredits?.accounts_used ?? 0;
  const creditTotal = userCredits?.accounts_limit ?? 3;

  const completedAccounts = accounts.filter((a: any) => a.status === "completed");
  const avgScore =
    completedAccounts.length > 0
      ? (
          completedAccounts.reduce((sum: number, a: any) => sum + (a.priority_score ?? a.priorityScore ?? 0), 0) /
          completedAccounts.length
        ).toFixed(1)
      : "—";

  const kpis = [
    { label: "Comptes analysés", value: String(accounts.length), sub: "au total", icon: BarChart3, trend: "", trendUp: true },
    {
      label: "Contacts identifiés",
      value: String(accounts.reduce((sum, a) => sum + (a.raw_analysis?.contacts?.length || 0), 0)),
      sub: "au total",
      icon: Users,
      trend: "",
      trendUp: true,
    },
    {
      label: "Messages générés",
      value: String(
        accounts.reduce(
          (sum, a) =>
            sum +
            (a.raw_analysis?.contacts?.reduce(
              (acc: number, c: any) =>
                acc +
                (c.emailMessage ? 1 : 0) +
                (c.linkedinMessage ? 1 : 0) +
                (c.followupMessage ? 1 : 0),
              0,
            ) || 0),
        0,
      ),
      sub: "emails / LinkedIn / relances",
      icon: Mail,
      trend: "",
      trendUp: true,
    },
    { label: "Score moyen", value: String(avgScore), sub: "/10", icon: Target, trend: "", trendUp: true },
  ];

  const weeklyData = useMemo(() => {
    const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    return days.map((name, i) => ({
      name,
      value: accounts.filter(a => new Date(a.created_at).getDay() === (i + 1) % 7).length,
    }));
  }, [accounts]);

  const trendData = useMemo(() => {
    // Approximation simple : compter les comptes par semaine (4 dernières semaines)
    const weeks = ["S-3", "S-2", "S-1", "Semaine"];
    const now = new Date();
    return weeks.map((name, idx) => {
      const start = new Date(now);
      start.setDate(now.getDate() - (3 - idx) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const comptes = accounts.filter(a => {
        const d = new Date(a.created_at);
        return d >= start && d < end;
      }).length;
      const contacts = accounts.reduce((sum, a) => {
        const d = new Date(a.created_at);
        if (d >= start && d < end) {
          return sum + (a.raw_analysis?.contacts?.length || 0);
        }
        return sum;
      }, 0);
      return { name, comptes, contacts };
    });
  }, [accounts]);

  const scoreData = useMemo(() => {
    const buckets = { high: 0, medium: 0, low: 0 };
    accounts.forEach(a => {
      const s = a.priority_score ?? 0;
      if (s >= 8) buckets.high += 1;
      else if (s >= 5) buckets.medium += 1;
      else buckets.low += 1;
    });
    const total = accounts.length || 1;
    return [
      { name: "8-10", value: Math.round((buckets.high / total) * 100), color: "hsl(142 71% 45%)" },
      { name: "5-7", value: Math.round((buckets.medium / total) * 100), color: "hsl(38 92% 50%)" },
      { name: "1-4", value: Math.round((buckets.low / total) * 100), color: "hsl(0 84% 60%)" },
    ];
  }, [accounts]);

  const sectorData = useMemo(() => {
    const counts: Record<string, number> = {};
    accounts.forEach(a => {
      const sector = a.sector || "Autre";
      counts[sector] = (counts[sector] || 0) + 1;
    });
    const total = accounts.length || 1;
    return Object.entries(counts).map(([name, count]) => ({
      name,
      pct: Math.round((count / total) * 100),
    }));
  }, [accounts]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* Header */}
        <motion.div variants={fadeUp} className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Bonjour{firstName ? ` ${firstName}` : ""} 👋</h1>
            <p className="text-sm text-foreground/50 mt-1">Voici un résumé de votre activité commerciale</p>
          </div>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 border border-primary/20 bg-primary/5 text-primary text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            Plan {(credits?.plan || mockCredits.plan).toLowerCase()}
          </Badge>
        </motion.div>

        {/* Search bar */}
        <motion.div variants={fadeUp} className="mb-8">
          <Card className="border-border bg-card overflow-hidden">
            <CardContent className="p-4">
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
                  <Zap className="h-4 w-4 mr-2" />
                  Analyser
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* KPIs */}
        <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="border-border card-hover group">
            <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                      <kpi.icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </div>
                <p className="font-display text-2xl font-bold">{kpi.value}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground/40">{kpi.sub}</span>
                  <span className="text-xs text-bellum-success flex items-center gap-0.5">
                    <TrendingUp className="h-3 w-3" />
                    {kpi.trend}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Credits card */}
        <motion.div variants={fadeUp} className="mb-6">
          <Card className="border-border bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-5 flex items-center gap-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Crédits restants</span>
                  <span className="font-display text-lg font-bold">
                    {remaining}
                  <span className="text-sm text-foreground/40 font-normal">/{creditTotal}</span>
                  </span>
                </div>
                <Progress value={usagePercent} className="h-2" />
                <p className="text-xs text-foreground/40 mt-1.5">Renouvellement le 1er du mois prochain</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/billing")} className="shrink-0">
                Gérer
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Charts row */}
        {hasAccounts && (
          <motion.div variants={fadeUp} className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Activity trend */}
            <Card className="border-border">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Évolution sur 6 semaines
                </h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorComptes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(239 84% 67%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(239 84% 67%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="hsl(240 10% 40%)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(240 10% 40%)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: "hsl(240 17% 8%)", border: "1px solid hsl(240 17% 14%)", borderRadius: "8px", fontSize: "12px" }}
                        labelStyle={{ color: "hsl(240 10% 55%)" }}
                      />
                      <Area type="monotone" dataKey="comptes" stroke="hsl(239 84% 67%)" fillOpacity={1} fill="url(#colorComptes)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Weekly activity */}
            <Card className="border-border">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Activité cette semaine
                </h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                      <XAxis dataKey="name" stroke="hsl(240 10% 40%)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(240 10% 40%)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: "hsl(240 17% 8%)", border: "1px solid hsl(240 17% 14%)", borderRadius: "8px", fontSize: "12px" }}
                        labelStyle={{ color: "hsl(240 10% 55%)" }}
                      />
                      <Bar dataKey="value" fill="hsl(239 84% 67%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Recent accounts or empty state */}
        <motion.div variants={fadeUp}>
          {hasAccounts ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Comptes récents
                </h3>
                <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => navigate("/accounts")}>
                  Voir tout <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <Card className="border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">Entreprise</TableHead>
                      <TableHead className="text-xs font-semibold">Score</TableHead>
                      <TableHead className="text-xs font-semibold">Contacts</TableHead>
                      <TableHead className="text-xs font-semibold">Statut</TableHead>
                      <TableHead className="text-xs font-semibold">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayAccounts.slice(0, 5).map((a: any) => (
                      <TableRow key={a.id} className="cursor-pointer row-hover" onClick={() => navigate(`/accounts/${a.id}`)}>
                        <TableCell className="font-medium flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary">
                            <Building2 className="h-3.5 w-3.5 text-foreground/60" />
                          </div>
                          {a.company_name ?? a.companyName}
                        </TableCell>
                        <TableCell><PriorityBadge score={a.priority_score ?? a.priorityScore} size="sm" /></TableCell>
                        <TableCell className="text-sm text-foreground/60 font-mono">{20 + (a.priority_score ?? a.priorityScore) * 3}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-xs ${a.status === "completed" ? "bg-bellum-success/10 text-bellum-success border-bellum-success/20" : "bg-bellum-warning/10 text-bellum-warning border-bellum-warning/20"}`}>
                            {a.status === "completed" ? "✅ Prêt" : "⏳ En cours"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-foreground/50">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(a.created_at ?? a.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          ) : (
            <EmptyState type="accounts" />
          )}
        </motion.div>

        {/* Bottom charts */}
        {hasAccounts && (
          <motion.div variants={fadeUp} className="grid md:grid-cols-2 gap-4 mt-6">
            <Card className="border-border">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Top secteurs
                </h3>
                <div className="space-y-3">
                  {sectorData.map((s) => (
                    <div key={s.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-foreground/60">{s.name}</span>
                        <span className="font-mono font-medium">{s.pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${s.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Répartition des scores
                </h3>
                <div className="h-40 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={scoreData} dataKey="value" innerRadius={40} outerRadius={65} paddingAngle={3}>
                        {scoreData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {scoreData.map((s) => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs text-foreground/50">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}: {s.value}%
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
