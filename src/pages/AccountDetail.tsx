import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, FileSpreadsheet, Pencil, Building2, Users,
  GitBranch, AlertTriangle, TrendingUp, Target, Mail, Linkedin,
  RotateCw, Phone, ExternalLink, Copy, CheckCircle, Star, Loader2, Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAccount, useAccountActionPlan, useAccountAngles, useAccountContacts } from "@/hooks/useAccounts";
import type { AccountAnalysis, Contact, AttackAngle, ActionPlan } from "@/types/account";
import { generateCSV, downloadCSV } from "@/lib/export-csv";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
      {copied ? <CheckCircle className="h-3.5 w-3.5 text-bellum-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </Button>
  );
}

function Info({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {isLink ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
          {value.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  );
}

function TabFiche({ account }: { account: AccountAnalysis }) {
  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardContent className="p-5 space-y-1">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-primary" />Informations générales
          </h3>
          <Info label="Secteur" value={account.sector || "—"} />
          <Info label="Effectifs" value={account.employees || "—"} />
          <Info label="CA" value={account.revenue || "—"} />
          <Info label="Siège" value={account.headquarters || "—"} />
          <Info label="Site web" value={account.website || "—"} isLink={!!account.website} />
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />Filiales pertinentes
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(account.subsidiaries || []).length > 0 ? (
              account.subsidiaries.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </CardContent>
      </Card>

      {(account.raw_analysis?.programNames?.length > 0) && (
        <Card className="border-border">
          <CardContent className="p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />Programmes et projets détectés
            </h3>
            <ul className="text-sm space-y-1">
              {account.raw_analysis.programNames.map((name: string, i: number) => (
                <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />{name}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(account.raw_analysis?.entitiesExhaustive?.length > 0) && (
        <Card className="border-border">
          <CardContent className="p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />Cartographie des entités
            </h3>
            <div className="space-y-2 text-sm">
              {account.raw_analysis.entitiesExhaustive.map((e: { name?: string; type?: string; parent?: string }, i: number) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{e.name || "—"}</Badge>
                  <span className="text-muted-foreground text-xs">{e.type || ""}</span>
                  {e.parent && <span className="text-muted-foreground text-xs">← {e.parent}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />Enjeux IT identifiés
          </h3>
          <ul className="space-y-2">
            {(account.it_challenges || []).map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{c}
              </li>
            ))}
            {(account.it_challenges || []).length === 0 && (
              <li className="text-sm text-muted-foreground">—</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />🔔 Signaux récents
          </h3>
          <div className="space-y-2">
            {(account.recent_signals || []).map((s, i) => {
              const icons = ["📰", "💼", "📢", "🔄", "📊"];
              return (
                <div key={i} className="flex items-start gap-2.5 text-sm rounded-md p-2.5 bg-secondary/30 border border-border">
                  <span>{icons[i % icons.length]}</span>
                  <span>{s}</span>
                </div>
              );
            })}
            {(account.recent_signals || []).length === 0 && (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">Score de priorité : {account.priority_score}/10</p>
          <p className="text-sm text-foreground/80">&ldquo;{account.priority_justification || "—"}&rdquo;</p>
        </CardContent>
      </Card>
    </div>
  );
}

function TabContacts({ contacts, companyName }: { contacts: Contact[]; companyName: string }) {
  const { toast } = useToast();
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const contact = contacts.find((c) => c.id === selectedContact);

  const roles = [...new Set(contacts.map(c => c.decision_role).filter(Boolean))];

  const filtered = contacts.filter(c => {
    if (priorityFilter !== "all" && String(c.priority) !== priorityFilter) return false;
    if (roleFilter !== "all" && c.decision_role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{contacts.length} contacts identifiés</p>
        <div className="flex items-center gap-2">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs bg-card"><SelectValue placeholder="Priorité" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes priorités</SelectItem>
              <SelectItem value="1">★ Priorité 1</SelectItem>
              <SelectItem value="2">★ Priorité 2</SelectItem>
              <SelectItem value="3">★ Priorité 3</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs bg-card"><SelectValue placeholder="Rôle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous rôles</SelectItem>
              {roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const csv = generateCSV(contacts, companyName);
              const date = new Date().toISOString().split("T")[0];
              downloadCSV(csv, `bellum_${companyName.toLowerCase().replace(/\s+/g, "_")}_contacts_${date}.csv`);
              toast({ title: "Export CSV", description: `${contacts.length} contacts exportés.` });
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
          </Button>
        </div>
      </div>

      <Card className="border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Priorité</TableHead>
              <TableHead className="text-xs">Nom</TableHead>
              <TableHead className="text-xs">Poste</TableHead>
              <TableHead className="text-xs">Entité</TableHead>
              <TableHead className="text-xs">Rôle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c, i) => (
              <TableRow
                key={c.id}
                className={`cursor-pointer transition-colors row-hover ${c.id === selectedContact ? "bg-primary/5" : ""}`}
                onClick={() => setSelectedContact(c.id === selectedContact ? null : c.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-bellum-warning" />
                    <span className="font-mono text-xs">{c.priority}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-sm">{c.full_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.title || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.entity || "—"}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{c.decision_role || "unknown"}</Badge></TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Aucun contact trouvé avec ces filtres.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Organigramme dynamique */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold">Organigramme simplifié</h3>
          <div className="text-sm font-mono space-y-1 text-muted-foreground pl-2">
            {(() => {
              const byEntity = contacts.reduce((acc: Record<string, Contact[]>, c: Contact) => {
                const entity = c.entity || "Groupe";
                if (!acc[entity]) acc[entity] = [];
                acc[entity].push(c);
                return acc;
              }, {});

              return Object.entries(byEntity).map(([entity, entityContacts]) => (
                <div key={entity} className="mb-3">
                  <p className="text-foreground font-semibold">{entity.toUpperCase()}</p>
                  {[...entityContacts]
                    .sort((a, b) => a.priority - b.priority)
                    .map((c, i) => (
                      <p key={c.id} className="pl-4">
                        {i === entityContacts.length - 1 ? "└──" : "├──"}{" "}
                        {c.full_name} ({c.title}) —{" "}
                        <Badge variant="secondary" className="text-[10px]">
                          {c.decision_role === "sponsor" ? "Sponsor" :
                           c.decision_role === "champion" ? "Champion" :
                           c.decision_role === "operational" ? "Opérationnel" :
                           c.decision_role === "purchasing" ? "Achats" :
                           c.decision_role === "blocker" ? "Bloqueur" :
                           c.decision_role === "influencer" ? "Influenceur" :
                           "Inconnu"}
                        </Badge>
                      </p>
                    ))}
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">Cliquer sur un contact pour voir ses détails ↓</p>

      {contact && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{contact.full_name} — {contact.title || "—"}, {contact.entity || "—"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs">Rôle : {contact.decision_role || "unknown"}</Badge>
                    {contact.source === "linkedin_apify" ? (
                      <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                        LinkedIn
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                        IA
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{contact.email || "—"}</span>
                  {contact.email && <Badge variant="secondary" className="text-[10px]">{contact.email_verified ? "✅ vérifié" : "⚠️ non vérifié"}</Badge>}
                  {contact.email && <CopyButton text={contact.email} />}
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{contact.phone || "—"}</span>
                  {contact.phone && <CopyButton text={contact.phone} />}
                </div>
                <div className="flex items-center gap-2">
                  <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
                  {contact.linkedin_url ? (
                    <>
                      <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {contact.linkedin_url}
                      </a>
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                        <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      </Button>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Résumé profil</p>
                <p className="text-sm text-foreground/80">&ldquo;{contact.profile_summary || "—"}&rdquo;</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pourquoi le contacter</p>
                <p className="text-sm text-foreground/80">&ldquo;{contact.why_contact || "—"}&rdquo;</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

function TabOrganigramme({ account, contacts }: { account: AccountAnalysis; contacts: Contact[] }) {
  const entities = useMemo(() => {
    const fromRaw = (account.raw_analysis?.entitiesExhaustive || []).map((e: { name?: string; type?: string; parent?: string }) => e.name || "");
    if (fromRaw.length > 0) return [...new Set(fromRaw)];
    const fromSubs = account.subsidiaries || [];
    const fromContacts = contacts.map((c) => c.entity).filter(Boolean) as string[];
    return [...new Set(["Groupe", ...fromSubs, ...fromContacts])];
  }, [account.raw_analysis?.entitiesExhaustive, account.subsidiaries, contacts]);

  const contactsByEntity = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    for (const e of entities) map[e] = [];
    for (const c of contacts) {
      const key = (c.entity || "Groupe").trim() || "Groupe";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    return map;
  }, [entities, contacts]);

  const roleLabel: Record<string, string> = {
    sponsor: "Décideur",
    champion: "Champion",
    operational: "Opérationnel",
    purchasing: "Achats",
    influencer: "Influenceur",
    blocker: "Blocant",
    unknown: "—",
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Hiérarchie : entités du groupe et décideurs identifiés. Les zones sans contact sont signalées.
      </p>
      <div className="relative">
        {/* Niveau 0 : entreprise */}
        <div className="flex justify-center mb-4">
          <div className="rounded-lg border-2 border-primary bg-primary/10 px-4 py-2 text-sm font-semibold">
            {account.company_name}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-px h-4 bg-border" />
        </div>
        {/* Niveau 1 : entités */}
        <div className="flex flex-wrap justify-center gap-4 mt-2">
          {entities.map((entity) => {
            const list = contactsByEntity[entity] || [];
            const uncovered = list.length === 0;
            return (
              <div key={entity} className="flex flex-col items-center min-w-[200px]">
                <div className="w-px h-4 bg-border shrink-0" />
                <div
                  className={`rounded-lg border-2 px-3 py-2 w-full text-center text-sm font-medium ${
                    uncovered ? "border-dashed border-muted-foreground/50 bg-muted/30 text-muted-foreground" : "border-border bg-card"
                  }`}
                >
                  {entity}
                  {uncovered && <span className="block text-xs mt-1">Zone non couverte</span>}
                </div>
                <div className="w-px flex-1 min-h-[8px] bg-border mt-2" />
                <div className="mt-2 space-y-2 w-full">
                  {list.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-md border border-border bg-background px-3 py-2 text-left text-xs"
                    >
                      <div className="font-medium text-foreground">{c.full_name}</div>
                      <div className="text-muted-foreground">{c.title || "—"}</div>
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {roleLabel[c.decision_role] || c.decision_role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TabOuvrirCompte({ raw }: { raw: any }) {
  const data = raw?.commentOuvrirCompte;
  if (!data) return <p className="text-sm text-muted-foreground">Aucune donnée disponible. Relancez une analyse pour générer cette section.</p>;
  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold">Stratégie d&apos;entrée</h3>
          <p className="text-sm text-foreground/90 whitespace-pre-line">{data.strategy || "—"}</p>
        </CardContent>
      </Card>
      {(data.entryPoints?.length > 0) && (
        <Card className="border-border">
          <CardContent className="p-5 space-y-3">
            <h3 className="font-display text-sm font-semibold">Portes d&apos;entrée recommandées</h3>
            <ul className="space-y-2">
              {data.entryPoints.map((ep: { label?: string; justification?: string }, i: number) => (
                <li key={i} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{ep.label || "—"}</span>
                  {ep.justification && <span className="text-muted-foreground text-xs">{ep.justification}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TabOffresConstruire({ raw }: { raw: any }) {
  const data = raw?.offresAConstruire;
  if (!data) return <p className="text-sm text-muted-foreground">Aucune donnée disponible. Relancez une analyse pour générer cette section.</p>;
  const offers = data.offers || [];
  if (offers.length === 0) return <p className="text-sm text-muted-foreground">Aucune offre recommandée.</p>;
  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardContent className="p-5 space-y-4">
          <h3 className="font-display text-sm font-semibold">Offres ESN à proposer</h3>
          {offers.map((o: { offer?: string; order?: number; interlocutor?: string; pitch?: string }, i: number) => (
            <div key={i} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 text-sm font-medium">#{o.order ?? i + 1} — {o.offer || "—"}</div>
              {o.interlocutor && <p className="text-xs text-muted-foreground mt-1">Pour : {o.interlocutor}</p>}
              {o.pitch && <p className="text-sm text-foreground/80 mt-2">{o.pitch}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function TabPlanHebdo({ raw }: { raw: any }) {
  const data = raw?.planHebdomadaire;
  if (!data) return <p className="text-sm text-muted-foreground">Aucune donnée disponible. Relancez une analyse pour générer cette section.</p>;
  const weeks = data.weeks || [];
  return (
    <div className="space-y-6">
      {data.methodology && (
        <p className="text-xs text-muted-foreground italic">{data.methodology}</p>
      )}
      {weeks.map((w: { week?: number; theme?: string; actions?: string[] }, i: number) => (
        <Card key={i} className="border-border">
          <CardContent className="p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Semaine {w.week ?? i + 1} — {w.theme ?? "—"}</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {(w.actions || []).map((a: string, j: number) => <li key={j}>{a}</li>)}
            </ul>
          </CardContent>
        </Card>
      ))}
      {weeks.length === 0 && <p className="text-sm text-muted-foreground">Aucune action hebdomadaire.</p>}
    </div>
  );
}

function TabEvaluation({ raw }: { raw: any }) {
  const data = raw?.evaluationCompte;
  if (!data) return <p className="text-sm text-muted-foreground">Aucune donnée disponible. Relancez une analyse pour générer cette section.</p>;
  const goNoGo = (data.goNoGo || "").toUpperCase();
  const isGo = goNoGo === "GO";
  return (
    <div className="space-y-6">
      <Card className={`border-2 ${isGo ? "border-bellum-success/50 bg-bellum-success/5" : "border-destructive/30 bg-destructive/5"}`}>
        <CardContent className="p-5 space-y-2">
          <p className="text-sm font-semibold">Recommandation : <span className={isGo ? "text-bellum-success" : "text-destructive"}>{data.goNoGo || "—"}</span></p>
          <p className="text-2xl font-bold">Score global : {data.scoreGlobal ?? "—"}/10</p>
        </CardContent>
      </Card>
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold">Justification</h3>
          <p className="text-sm text-foreground/90 whitespace-pre-line">{data.justification || "—"}</p>
        </CardContent>
      </Card>
      {data.recommandation && (
        <Card className="border-border">
          <CardContent className="p-5">
            <h3 className="font-display text-sm font-semibold mb-2">Recommandation</h3>
            <p className="text-sm text-foreground/90 whitespace-pre-line">{data.recommandation}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TabPlan({ angles, actionPlan }: { angles: AttackAngle[]; actionPlan: ActionPlan | null }) {
  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1.5">
            Stratégie recommandée : {actionPlan?.strategy_type || "—"}
          </p>
          <p className="text-sm text-foreground/80">&ldquo;{actionPlan?.strategy_justification || "—"}&rdquo;</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />{angles.length} angle{angles.length > 1 ? "s" : ""} d&apos;attaque
        </h3>
        {angles.map((angle) => (
          <Card key={angle.id} className={`border-border ${angle.is_recommended ? "border-primary/30 ring-1 ring-primary/10" : ""}`}>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />{angle.title}
                </h4>
                {angle.is_recommended && <Badge className="bg-primary text-primary-foreground text-[10px]">★ Best</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{angle.description || "—"}</p>
              <p className="text-xs text-muted-foreground italic">{angle.entry_point || "—"}</p>
            </CardContent>
          </Card>
        ))}
        {angles.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-sm font-semibold">Plan d&apos;action 4 semaines</h3>
        {(actionPlan?.weeks || []).map((week) => (
          <Card key={week.week} className="border-border">
            <CardContent className="p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Semaine {week.week} — {week.title}
              </p>
              <div className="space-y-2">
                {week.items.map((item, i) => {
                  const extra = (item as { responsable?: string; outil?: string; deadline?: string; kpi?: string });
                  const hasMeta = extra.responsable || extra.outil || extra.deadline || extra.kpi;
                  return (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <Checkbox className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-foreground/80">{item.text}</span>
                        {hasMeta && (
                          <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                            {extra.responsable && <span>Responsable : {extra.responsable}</span>}
                            {extra.outil && <span>Outil : {extra.outil}</span>}
                            {extra.deadline && <span>Deadline : {extra.deadline}</span>}
                            {extra.kpi && <span>KPI : {extra.kpi}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
        {(actionPlan?.weeks || []).length === 0 && <p className="text-sm text-muted-foreground">—</p>}
      </div>
    </div>
  );
}

function TabMessages({ contacts }: { contacts: Contact[] }) {
  const [filter, setFilter] = useState<string>("all");

  const messageGroups = useMemo(() => {
    return contacts.map((c) => {
      const msgs: { type: "email" | "linkedin" | "relance"; subject?: string; body: string }[] = [];
      if (c.email_message?.body) {
        msgs.push({ type: "email", subject: c.email_message.subject, body: c.email_message.body });
      }
      if (c.linkedin_message) {
        msgs.push({ type: "linkedin", body: c.linkedin_message });
      }
      if (c.followup_message?.body) {
        msgs.push({ type: "relance", subject: c.followup_message.subject, body: c.followup_message.body });
      }
      return { contact: c, messages: msgs };
    }).filter((g) => g.messages.length > 0);
  }, [contacts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Messages prêts à envoyer</p>
        <CopyButton text="Tout copier" />
      </div>

      <div className="flex gap-2">
        {["all", "email", "linkedin", "relance"].map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Tous" : f === "email" ? "Email" : f === "linkedin" ? "LinkedIn" : "Relances"}
          </Button>
        ))}
      </div>

      {messageGroups.map((g) => {
        const filteredMsgs = filter === "all" ? g.messages : g.messages.filter((m) => m.type === filter);
        if (filteredMsgs.length === 0) return null;
        return (
          <div key={g.contact.id} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
              Pour : {g.contact.full_name} ({g.contact.title || "—"})
            </p>
            {filteredMsgs.map((m, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs gap-1">
                      {m.type === "email" && <><Mail className="h-3 w-3" />Email</>}
                      {m.type === "linkedin" && <><Linkedin className="h-3 w-3" />LinkedIn</>}
                      {m.type === "relance" && <><RotateCw className="h-3 w-3" />Relance J+5</>}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <CopyButton text={m.subject ? `Objet : ${m.subject}\n\n${m.body}` : m.body} />
                      {m.type === "email" && m.subject && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs gap-1 text-muted-foreground"
                          onClick={() => {
                            const subject = encodeURIComponent(m.subject || "");
                            const body = encodeURIComponent(m.body || "");
                            const email = g.contact?.email ? encodeURIComponent(g.contact.email) : "";
                            window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`, "_blank");
                          }}
                        >
                          <Mail className="h-3 w-3" />Gmail
                        </Button>
                      )}
                    </div>
                  </div>
                  {m.subject && <p className="text-xs text-muted-foreground"><span className="font-semibold">Objet :</span> {m.subject}</p>}
                  <p className="text-sm text-foreground/80 whitespace-pre-line">{m.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}
      {messageGroups.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
    </div>
  );
}

export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { account, isLoading: accountLoading, error: accountError } = useAccount(id, { refetchWhenAnalyzing: true });
  const { contacts } = useAccountContacts(id);
  const { angles } = useAccountAngles(id);
  const { actionPlan } = useAccountActionPlan(id);
  const [adjustPrompt, setAdjustPrompt] = useState("");

  const isAnalyzing = account?.status === "analyzing";
  const analysisSteps = useMemo(() => {
    if (!isAnalyzing) return [];
    const hasSector = !!account?.sector;
    const hasContacts = (contacts?.length ?? 0) > 0;
    const hasAngles = (angles?.length ?? 0) > 0;
    return [
      { label: "Recherche web", done: true },
      { label: "Données entreprise", done: hasSector },
      { label: "Analyse IA du compte", done: hasSector },
      { label: "Scraping LinkedIn", done: hasSector },
      { label: "Construction organigramme", done: hasContacts },
      { label: "Enrichissement contacts", done: hasContacts },
      { label: "Génération messages", done: hasAngles },
    ];
  }, [isAnalyzing, account?.sector, contacts?.length, angles?.length]);

  const contactCount = contacts.length;

  if (accountLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (accountError || !account) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center space-y-3">
        <p className="text-sm text-destructive">Compte non trouvé ou erreur de chargement.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/accounts")}>Retour aux comptes</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Avancement détaillé quand le compte est encore "En cours" */}
      {isAnalyzing && analysisSteps.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Analyse en cours — vous pouvez suivre l&apos;avancement ici
            </p>
            <p className="text-xs text-muted-foreground">
              La page se met à jour toutes les 2 secondes. Vous pouvez aussi retourner sur Nouvelle recherche pour voir le suivi.
            </p>
            <div className="mt-3 space-y-1.5">
              {analysisSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  {step.done ? <CheckCircle className="h-4 w-4 text-bellum-success shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                  <span className={step.done ? "text-foreground" : "text-muted-foreground"}>{step.label}</span>
                  {step.done && <span className="text-xs text-muted-foreground">Terminé</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/accounts")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">{account.company_name}</h1>
              <p className="text-sm text-muted-foreground">{account.sector || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Score :</span>
              <Progress value={account.priority_score * 10} className="w-20 h-2" />
              <PriorityBadge score={account.priority_score} size="sm" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (contacts.length === 0) {
                  toast({ title: "Aucun contact", description: "Pas de contacts à exporter pour ce compte." });
                  return;
                }
                const csv = generateCSV(contacts, account.company_name);
                const date = new Date().toISOString().split("T")[0];
                const filename = `bellum_${account.company_name.toLowerCase().replace(/\s+/g, "_")}_${date}.csv`;
                downloadCSV(csv, filename);
                toast({ title: "Export réussi", description: `${contacts.length} contacts exportés dans ${filename}` });
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (contacts.length === 0) {
                  toast({ title: "Aucun contact", description: "Pas de contacts à exporter." });
                  return;
                }
                const csv = generateCSV(contacts, account.company_name);
                const date = new Date().toISOString().split("T")[0];
                downloadCSV(csv, `bellum_${account.company_name.toLowerCase().replace(/\s+/g, "_")}_${date}.csv`);
                toast({
                  title: "Fichier CSV téléchargé",
                  description: "Ouvrez Google Sheets → Fichier → Importer → Sélectionnez le CSV téléchargé.",
                });
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />Sheets
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="fiche">
        <TabsList className="bg-secondary/50 flex-wrap h-auto gap-1">
          <TabsTrigger value="fiche">Fiche compte</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contactCount})</TabsTrigger>
          <TabsTrigger value="organigramme">Organigramme</TabsTrigger>
          <TabsTrigger value="plan">Plan d&apos;action</TabsTrigger>
          <TabsTrigger value="ouvrir">Ouvrir ce compte</TabsTrigger>
          <TabsTrigger value="offres">Offres à construire</TabsTrigger>
          <TabsTrigger value="plan-hebdo">Plan hebdo</TabsTrigger>
          <TabsTrigger value="evaluation">Évaluation</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="fiche" className="mt-6"><TabFiche account={account} /></TabsContent>
        <TabsContent value="contacts" className="mt-6"><TabContacts contacts={contacts as Contact[]} companyName={account.company_name} /></TabsContent>
        <TabsContent value="organigramme" className="mt-6"><TabOrganigramme account={account} contacts={contacts as Contact[]} /></TabsContent>
        <TabsContent value="plan" className="mt-6"><TabPlan angles={angles as AttackAngle[]} actionPlan={actionPlan as ActionPlan | null} /></TabsContent>
        <TabsContent value="ouvrir" className="mt-6"><TabOuvrirCompte raw={account.raw_analysis} /></TabsContent>
        <TabsContent value="offres" className="mt-6"><TabOffresConstruire raw={account.raw_analysis} /></TabsContent>
        <TabsContent value="plan-hebdo" className="mt-6"><TabPlanHebdo raw={account.raw_analysis} /></TabsContent>
        <TabsContent value="evaluation" className="mt-6"><TabEvaluation raw={account.raw_analysis} /></TabsContent>
        <TabsContent value="messages" className="mt-6"><TabMessages contacts={contacts as Contact[]} /></TabsContent>
      </Tabs>

      {/* Adjust zone */}
      <Card className="border-border">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />Ajuster la recherche
          </h3>
          <Input
            placeholder={'Ex : "Exclure la filiale UK", "Insister sur l\'angle cybersécurité", "Ajouter des profils data"'}
            value={adjustPrompt}
            onChange={(e) => setAdjustPrompt(e.target.value)}
            className="bg-card search-glow"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!adjustPrompt.trim()}
              onClick={() => {
                toast({ title: "Régénération lancée", description: "L'analyse est en cours de mise à jour avec vos ajustements." });
                setAdjustPrompt("");
              }}
            >
              Régénérer →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
