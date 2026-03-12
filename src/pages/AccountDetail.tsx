import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, FileSpreadsheet, Pencil, Building2, Users,
  GitBranch, AlertTriangle, TrendingUp, Target, Mail, Linkedin,
  RotateCw, Phone, ExternalLink, Copy, CheckCircle, Star, Loader2, Circle, MapPin,
  Gauge, DoorOpen, Lightbulb, FileCheck, ChevronRight, BarChart2, Zap, Shield, Gem, Flag,
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
import { useAccount, useAccountActionPlan, useAccountAngles, useAccountContacts, useCancelAnalysis } from "@/hooks/useAccounts";
import { useProfile } from "@/hooks/useProfile";
import type { AccountAnalysis, Contact, AttackAngle, ActionPlan } from "@/types/account";
import { generateCSV, downloadCSV } from "@/lib/export-csv";
import { safeString, cn } from "@/lib/utils";
import { FranceSitesMap } from "@/components/FranceSitesMap";

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
      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6 space-y-1">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-muted-foreground" />Informations générales
          </h3>
          <Info label="Secteur" value={account.sector || "—"} />
          <Info label="Effectifs" value={account.employees || "—"} />
          <Info label="CA" value={account.revenue || "—"} />
          <Info label="Siège" value={account.headquarters || "—"} />
          <Info label="Site web" value={account.website || "—"} isLink={!!account.website} />
        </CardContent>
      </Card>

      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6 space-y-3">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />Filiales pertinentes
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(account.subsidiaries || []).length > 0 ? (
              (account.subsidiaries || []).map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{safeString(s)}</Badge>)
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </CardContent>
      </Card>

      {(account.raw_analysis?.programNames?.length > 0) && (
        <Card className="border-border card-neutral rounded-xl">
          <CardContent className="p-6 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />Programmes et projets (noms réels)
            </h3>
            <ul className="text-sm space-y-1">
              {(account.raw_analysis?.programNames || []).map((item: unknown, i: number) => (
                <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 shrink-0" />{safeString(item)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {(account.raw_analysis?.budgetSignals?.length > 0) && (
        <Card className="border-border border-amber-500/20 card-neutral rounded-xl">
          <CardContent className="p-6 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />Budget, référencement, blocages
            </h3>
            <ul className="text-sm space-y-1">
              {(account.raw_analysis.budgetSignals || []).map((s: unknown, i: number) => (
                <li key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />{safeString(s)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(account.raw_analysis?.entitiesExhaustive?.length > 0) && (
        <Card className="border-border card-neutral rounded-xl">
          <CardContent className="p-6 space-y-3">
            <h3 className="font-display text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />Cartographie des entités
            </h3>
            <div className="space-y-2 text-sm">
              {(account.raw_analysis?.entitiesExhaustive || []).map((e: unknown, i: number) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{safeString((e as { name?: string })?.name)}</Badge>
                  <span className="text-muted-foreground text-xs">{safeString((e as { type?: string })?.type)}</span>
                  {(e as { parent?: string })?.parent != null && <span className="text-muted-foreground text-xs">← {safeString((e as { parent?: string }).parent)}</span>}
                  {(e as { region?: string })?.region != null && <span className="text-muted-foreground text-xs">· {safeString((e as { region?: string }).region)}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6 space-y-4">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />Sites en France
          </h3>
          <p className="text-xs text-muted-foreground">Sièges et implantations identifiés, positionnés sur la carte. Les prochaines analyses enrichiront cette section.</p>
          <FranceSitesMap sites={Array.isArray(account.raw_analysis?.sitesFrance) ? (account.raw_analysis.sitesFrance as { city?: string; region?: string; type?: string; label?: string; importance?: string }[]) : []} />
          {Array.isArray(account.raw_analysis?.sitesFrance) && account.raw_analysis.sitesFrance.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">Ville</TableHead>
                    <TableHead className="text-xs">Région</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Priorité</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(account.raw_analysis.sitesFrance as { city?: string; region?: string; type?: string; label?: string; importance?: string }[]).map((s, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="text-sm font-medium">{safeString(s.city)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{safeString(s.region)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{safeString(s.type ?? s.label)}</TableCell>
                      <TableCell>
                        <Badge variant={s.importance === "haute" ? "default" : "secondary"} className="text-xs">
                          {safeString(s.importance) || "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6 space-y-3">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />Ce qu’ils veulent régler (côté IT)
          </h3>
          <p className="text-xs text-muted-foreground">À citer dans vos messages et au téléphone. Une phrase suffit.</p>
          <ul className="space-y-2">
            {(account.it_challenges || []).map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />{c}
              </li>
            ))}
            {(account.it_challenges || []).length === 0 && (
              <li className="text-sm text-muted-foreground">—</li>
            )}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6 space-y-3">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />Ce qui se passe (bon prétexte pour relancer)
          </h3>
          <p className="text-xs text-muted-foreground">Citez un signal, posez une question, proposez une étape simple.</p>
          <div className="space-y-2">
            {(account.recent_signals || []).map((s: unknown, i: number) => {
              const icons = ["📰", "💼", "📢", "🔄", "📊"];
              return (
                <div key={i} className="flex items-start gap-2.5 text-sm rounded-md p-2.5 bg-secondary/30 border border-border">
                  <span>{icons[i % icons.length]}</span>
                  <span>{safeString(s)}</span>
                </div>
              );
            })}
            {(account.recent_signals || []).length === 0 && (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Score de priorité : {account.priority_score}/10</p>
          <p className="text-xs text-muted-foreground mb-2">Plus c’est haut, plus ça vaut votre temps (maintenant).</p>
          <p className="text-sm text-foreground/90">&ldquo;{typeof account.priority_justification === "string" ? account.priority_justification : (account.priority_justification as { overall?: string } | null)?.overall ?? "—"}&rdquo;</p>
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
  const aiGeneratedCount = contacts.filter((c) => (c.source || "").toLowerCase() === "ai_generated").length;
  const showAiBanner = aiGeneratedCount > 0;

  const roles = [...new Set(contacts.map(c => c.decision_role).filter(Boolean))];

  const filtered = contacts.filter(c => {
    if (priorityFilter !== "all" && String(c.priority) !== priorityFilter) return false;
    if (roleFilter !== "all" && c.decision_role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {showAiBanner && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground/90">
          <p className="font-medium text-amber-700 dark:text-amber-400">Profils types suggérés (pas de personnes réelles)</p>
          <p className="mt-1 text-muted-foreground">
            Aucun contact LinkedIn n&apos;a été trouvé pour ce compte (Apify n&apos;a pas retourné de profils). Les noms et postes ci-dessous sont des <strong>profils types</strong> générés par l&apos;IA pour structurer votre approche — à remplacer par de vrais contacts une fois identifiés (LinkedIn, annuaire, etc.).
          </p>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          {contacts.length} contacts identifiés
          {contacts.length > 0 && (
            <span className="ml-1.5 text-xs text-muted-foreground/80">— prêts à mobiliser (emails, LinkedIn, relances)</span>
          )}
        </p>
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

      <div className="table-premium-wrapper">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-20">Priorité</TableHead>
              <TableHead className="text-xs min-w-[120px]">Nom</TableHead>
              <TableHead className="text-xs min-w-[160px]">Poste</TableHead>
              <TableHead className="text-xs min-w-[140px]">Entité</TableHead>
              <TableHead className="text-xs min-w-[100px] whitespace-nowrap" title="Rôle dans la décision : sponsor, champion, opérationnel, achats, influenceur">Rôle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow
                key={c.id}
                className={`table-row-hover cursor-pointer transition-colors ${c.id === selectedContact ? "bg-muted/50" : ""}`}
                onClick={() => setSelectedContact(c.id === selectedContact ? null : c.id)}
              >
                <TableCell className="align-middle">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-bellum-warning shrink-0" />
                    <span className="font-mono text-xs">{c.priority}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-sm align-middle">{c.full_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground align-middle">{c.title || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground align-middle">{c.entity || "—"}</TableCell>
                <TableCell className="align-middle"><Badge variant="secondary" className="text-xs capitalize">{c.decision_role || "unknown"}</Badge></TableCell>
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
      </div>

      {/* Organigramme dynamique */}
      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6 space-y-3">
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
          <Card className="border-border card-neutral rounded-xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{contact.full_name} — {contact.title || "—"}, {contact.entity || "—"}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-xs">Rôle : {contact.decision_role || "unknown"}</Badge>
                    {contact.source === "linkedin_apify" ? (
                      <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                        LinkedIn
                      </Badge>
                    ) : contact.source === "web_mentioned" ? (
                      <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Mention web
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground border-border">
                        Profil type
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
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const organigrammeLogic = account.raw_analysis && typeof account.raw_analysis === "object" && "organigrammeLogic" in account.raw_analysis
    ? (account.raw_analysis.organigrammeLogic as { hierarchy?: string; siblingEntities?: string; entryPoints?: string } | null | undefined)
    : undefined;
  const hasOrganigrammeLogic = organigrammeLogic && (organigrammeLogic.hierarchy || organigrammeLogic.siblingEntities || organigrammeLogic.entryPoints);

  const entities = useMemo(() => {
    const rawEntities = account.raw_analysis?.entitiesExhaustive;
    const fromRaw = Array.isArray(rawEntities)
      ? rawEntities.map((e: unknown) => safeString((e as { name?: string })?.name)).filter(Boolean)
      : [];
    if (fromRaw.length > 0) return [...new Set(fromRaw)];
    const fromSubs = Array.isArray(account.subsidiaries) ? account.subsidiaries : [];
    const fromContacts = safeContacts.map((c) => c.entity).filter(Boolean) as string[];
    return [...new Set(["Groupe", ...fromSubs, ...fromContacts])];
  }, [account.raw_analysis?.entitiesExhaustive, account.subsidiaries, safeContacts]);

  const contactsByEntity = useMemo(() => {
    const map: Record<string, Contact[]> = {};
    for (const e of entities) map[e] = [];
    for (const c of safeContacts) {
      const key = (c.entity || "Groupe").trim() || "Groupe";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    return map;
  }, [entities, safeContacts]);

  const roleLabel: Record<string, string> = {
    sponsor: "Décideur",
    champion: "Champion",
    operational: "Opérationnel",
    purchasing: "Achats",
    influencer: "Influenceur",
    blocker: "Blocant",
    unknown: "—",
  };

  const roleStyle: Record<string, { bar: string; badge: string }> = {
    sponsor: { bar: "border-t-4 border-t-emerald-500/70", badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300" },
    champion: { bar: "border-t-4 border-t-sky-500/70", badge: "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300" },
    operational: { bar: "border-t-4 border-t-violet-500/70", badge: "bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-300" },
    purchasing: { bar: "border-t-4 border-t-amber-500/70", badge: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300" },
    influencer: { bar: "border-t-4 border-t-fuchsia-500/70", badge: "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/20 dark:text-fuchsia-300" },
    blocker: { bar: "border-t-4 border-t-rose-500/70", badge: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-300" },
    unknown: { bar: "border-t-4 border-t-muted-foreground/30", badge: "bg-muted text-muted-foreground border-border" },
  };

  const entityMeta = useMemo(() => {
    return entities.map((entity) => {
      const list = contactsByEntity[entity] || [];
      const uncovered = list.length === 0;
      const byRole = list.reduce((acc: Record<string, number>, c) => {
        const r = (c.decision_role || "unknown").toLowerCase();
        acc[r] = (acc[r] || 0) + 1;
        return acc;
      }, {});
      return { entity, list, uncovered, byRole };
    });
  }, [entities, contactsByEntity]);

  function initials(name: string) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : (parts[0]?.[1] ?? "");
    return (a + b).toUpperCase().slice(0, 2) || "—";
  }

  return (
    <div className="space-y-6">
      {hasOrganigrammeLogic && (
        <Card className="border-border card-neutral rounded-xl">
          <CardContent className="p-6 space-y-3">
            <h3 className="font-display text-sm font-semibold text-foreground">Logique commerciale</h3>
            {organigrammeLogic.hierarchy && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Hiérarchie</p>
                <p className="text-sm text-foreground/90">{organigrammeLogic.hierarchy}</p>
              </div>
            )}
            {organigrammeLogic.siblingEntities && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Filiales côte à côte (métiers)</p>
                <p className="text-sm text-foreground/90">{organigrammeLogic.siblingEntities}</p>
              </div>
            )}
            {organigrammeLogic.entryPoints && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Portes d&apos;entrée</p>
                <p className="text-sm text-foreground/90">{organigrammeLogic.entryPoints}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-[260px]">
          <h3 className="font-display text-sm font-semibold">Organigramme</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Vue “compte → entités → contacts” pour repérer rapidement les zones couvertes et vos meilleurs points d’entrée.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm border border-border bg-card" /> Couvert
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm border border-dashed border-muted-foreground/50 bg-muted/30" /> Non couvert
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
            Décideur
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-sky-700 dark:text-sky-300">
            Champion
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-violet-700 dark:text-violet-300">
            Opérationnel
          </span>
        </div>
      </div>

      {/* Root */}
      <div className="flex justify-center">
        <div className="relative">
          <Card className="border-border card-neutral rounded-xl">
            <CardContent className="px-5 py-3">
              <div className="text-sm font-semibold text-center">{account.company_name}</div>
              <div className="text-[11px] text-muted-foreground text-center mt-0.5">{account.sector || "—"}</div>
            </CardContent>
          </Card>
          <div className="absolute left-1/2 -bottom-4 w-px h-4 bg-border" />
        </div>
      </div>

      {/* Entities grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {entityMeta.map(({ entity, list, uncovered, byRole }) => {
          const top3 = [...list].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).slice(0, 9);
          return (
            <Card
              key={entity}
              className={cn(
                "border-border card-neutral rounded-xl overflow-hidden",
                uncovered && "border-dashed"
              )}
            >
              <div className="px-5 pt-4 pb-3 border-b border-border bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{entity}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {uncovered ? "Zone non couverte" : `${list.length} contact${list.length > 1 ? "s" : ""} identifié${list.length > 1 ? "s" : ""}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(["sponsor", "champion", "operational", "purchasing", "influencer"] as const).map((r) => {
                      const n = byRole[r] || 0;
                      if (!n) return null;
                      const st = roleStyle[r] || roleStyle.unknown;
                      return (
                        <span key={r} className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", st.badge)}>
                          {roleLabel[r]} · {n}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <CardContent className="p-5">
                {uncovered ? (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
                    <p className="text-sm text-muted-foreground">Aucun contact sur cette entité.</p>
                    <p className="text-xs text-muted-foreground mt-1">Objectif : trouver au moins 1 champion + 1 sponsor + 1 opérationnel.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {top3.map((c) => {
                      const r = (c.decision_role || "unknown").toLowerCase();
                      const st = roleStyle[r] || roleStyle.unknown;
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "rounded-xl border border-border bg-card shadow-sm overflow-hidden",
                            st.bar
                          )}
                        >
                          <div className="p-3">
                            <div className="flex items-start gap-3">
                              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <span className="text-[11px] font-semibold text-muted-foreground">{initials(c.full_name)}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold truncate">{c.full_name}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2">{c.title || "—"}</div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", st.badge)}>
                                    {roleLabel[r] || r}
                                  </span>
                                  {typeof c.priority === "number" && (
                                    <span className="text-[10px] text-muted-foreground font-mono">P{c.priority}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TabOffresConstruire({ raw }: { raw: unknown }) {
  const data = raw && typeof raw === "object" && "offresAConstruire" in raw ? (raw as { offresAConstruire?: unknown }).offresAConstruire : null;
  const offres = data && typeof data === "object" && "offers" in data ? (data as { offers?: unknown[] }).offers : null;
  const offers = Array.isArray(offres) ? offres : [];
  if (offers.length === 0) return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
      <p className="text-sm text-muted-foreground">Aucune offre recommandée pour ce compte.</p>
      <p className="text-xs text-muted-foreground mt-1">Une analyse plus poussée peut faire apparaître des offres ESN à proposer.</p>
    </div>
  );
  return (
    <div className="space-y-4">
      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6 space-y-4">
          <h3 className="font-display text-sm font-semibold">Offres ESN à proposer</h3>
          {offers.map((o: unknown, i: number) => {
            const obj = o && typeof o === "object" ? o as { order?: number; offer?: unknown; interlocutor?: unknown; pitch?: unknown } : {};
            return (
              <div key={i} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 text-sm font-medium">#{obj.order ?? i + 1} — {safeString(obj.offer)}</div>
                {obj.interlocutor != null && <p className="text-xs text-muted-foreground mt-1">Pour : {safeString(obj.interlocutor)}</p>}
                {obj.pitch != null && <p className="text-sm text-foreground/80 mt-2">{safeString(obj.pitch)}</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function TabPlanHebdo({ raw }: { raw: unknown }) {
  const data = raw && typeof raw === "object" && "planHebdomadaire" in raw ? (raw as { planHebdomadaire?: unknown }).planHebdomadaire : null;
  const d = data && typeof data === "object" ? data as { methodology?: unknown; weeks?: unknown[] } : null;
  if (!d) return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
      <p className="text-sm text-muted-foreground">Aucune donnée disponible pour cet onglet.</p>
      <p className="text-xs text-muted-foreground mt-1">Relancez une analyse pour générer le plan hebdomadaire.</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.href = "/search"}>Nouvelle recherche</Button>
    </div>
  );
  const weeks = Array.isArray(d.weeks) ? d.weeks : [];
  if (weeks.length === 0 && !d.methodology) return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
      <p className="text-sm text-muted-foreground">Aucun plan hebdomadaire pour ce compte.</p>
      <p className="text-xs text-muted-foreground mt-1">Relancez une analyse pour générer un plan par semaine.</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.href = "/search"}>Nouvelle recherche</Button>
    </div>
  );
  return (
    <div className="space-y-6">
      {d.methodology != null && (
        <p className="text-xs text-muted-foreground italic">{safeString(d.methodology)}</p>
      )}
      {weeks.map((w: unknown, i: number) => {
        const obj = w && typeof w === "object" ? w as { week?: number; theme?: unknown; actions?: unknown[] } : {};
        const actions = Array.isArray(obj.actions) ? obj.actions : [];
        return (
          <Card key={i} className="border-border card-neutral rounded-xl">
            <CardContent className="p-6 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Semaine {obj.week ?? i + 1} — {safeString(obj.theme)}</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              {actions.map((a: unknown, j: number) => <li key={j}>{safeString(a)}</li>)}
            </ul>
          </CardContent>
        </Card>
        );
      })}
      {weeks.length === 0 && <p className="text-sm text-muted-foreground">Aucune action hebdomadaire.</p>}
    </div>
  );
}

function TabEvaluation({ raw, account, onboardingData }: { raw: unknown; account: AccountAnalysis; onboardingData?: any }) {
  // Source de vérité : le score & la justification affichés dans le bandeau général
  const scoreTop = typeof account.priority_score === "number" ? account.priority_score : Number(account.priority_score ?? 0) || 0;
  const topJustification =
    typeof account.priority_justification === "string"
      ? account.priority_justification
      : (account.priority_justification as { overall?: string } | null)?.overall ?? "";

  const evalData = raw && typeof raw === "object" && "evaluationCompte" in raw ? (raw as { evaluationCompte?: unknown }).evaluationCompte : null;
  const d = evalData && typeof evalData === "object"
    ? (evalData as { goNoGo?: unknown; scoreGlobal?: unknown; justification?: unknown; recommandation?: unknown })
    : null;

  const evalScore = d?.scoreGlobal != null ? Number(d.scoreGlobal) : null;
  const score = scoreTop || evalScore || 0;
  const goNoGoRaw = safeString(d?.goNoGo);
  const goNoGo = (goNoGoRaw && goNoGoRaw !== "—") ? String(goNoGoRaw).toUpperCase() : (score >= 7 ? "GO" : "NO-GO");
  const isGo = goNoGo === "GO";
  const mismatch = evalScore != null && Math.round(evalScore) !== Math.round(scoreTop);

  const size = safeString(onboardingData?.size);
  const team = safeString(onboardingData?.salesTeamSize);
  const challenge = safeString(onboardingData?.mainChallenge);

  const rawPriorityJustification = raw && typeof raw === "object" && "priorityJustification" in raw
    ? (raw as { priorityJustification?: any }).priorityJustification
    : null;
  const factors = rawPriorityJustification && typeof rawPriorityJustification === "object" && !Array.isArray(rawPriorityJustification)
    ? ([
        { key: "urgency", label: "Urgence", hint: "Signaux et timing", Icon: Zap },
        { key: "accessibility", label: "Accessibilité", hint: "Portes d’entrée", Icon: DoorOpen },
        { key: "competition", label: "Concurrence", hint: "Référencement / ESN en place", Icon: Flag },
        { key: "alignment", label: "Fit ESN", hint: "Adéquation offres/personas", Icon: Target },
        { key: "potential", label: "Potentiel", hint: "Valeur & périmètre", Icon: Gem },
      ] as const).map((f) => {
        const obj = (rawPriorityJustification as any)[f.key];
        const scoreF = obj?.score != null ? Number(obj.score) : null;
        const justifF = safeString(obj?.justification);
        return { ...f, score: scoreF, justification: justifF };
      })
    : [];

  const ouvrirData = raw && typeof raw === "object" && "commentOuvrirCompte" in raw ? (raw as { commentOuvrirCompte?: unknown }).commentOuvrirCompte : null;
  const ouvrir = ouvrirData && typeof ouvrirData === "object" ? ouvrirData as { strategy?: unknown; entryPoints?: unknown[] } : null;
  const entryPoints = Array.isArray(ouvrir?.entryPoints) ? ouvrir.entryPoints : [];

  const summaryBullets: string[] = [];
  if (size && size !== "—") summaryBullets.push(`Taille ESN : ${size} → approche recommandée alignée sur vos contraintes.`)
  if (team && team !== "—") summaryBullets.push(`Équipe commerciale : ${team} → plan priorisé pour maximiser le ratio effort/résultat.`)
  if (challenge && challenge !== "—") summaryBullets.push(`Défi principal : ${challenge} → messages/angles orientés conversion.`)

  const finalJustification = topJustification || safeString(d?.justification) || "—";
  const finalRecommendation = safeString(d?.recommandation);

  const esnSynergiesRaw =
    raw && typeof raw === "object" && "esnSynergies" in raw
      ? (raw as { esnSynergies?: any }).esnSynergies
      : null;
  const esnSynergies: { name?: string; certainty?: number; presenceType?: string; why?: string; adviceForUser?: string }[] =
    Array.isArray(esnSynergiesRaw) ? esnSynergiesRaw : [];

  return (
    <div className="space-y-6">
      {/* Intro Scoring business */}
      <Card className="border-border card-neutral rounded-xl bg-muted/20">
        <CardContent className="p-6 space-y-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <h2 className="font-display text-base font-semibold">Scoring business & décision</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cette vue consolide le score du compte, les facteurs de décision, la recommandation GO/NO-GO et la stratégie pour ouvrir le compte. Utilisez-la pour prioriser vos actions et choisir les bonnes portes d&apos;entrée.
          </p>
        </CardContent>
      </Card>

      {/* KPI header */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={cn("border-2 rounded-xl", isGo ? "border-bellum-success/40 bg-bellum-success/5" : "border-destructive/25 bg-destructive/5")}>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommandation</p>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="secondary" className={cn("text-sm px-2.5 py-0.5", isGo ? "bg-bellum-success/10 text-bellum-success border-bellum-success/20" : "bg-destructive/10 text-destructive border-destructive/20")}>
                {isGo ? "GO" : "NO-GO"}
              </Badge>
              <span className="text-xs text-muted-foreground">Décision rapide</span>
            </div>
            {mismatch && (
              <p className="text-[10px] text-muted-foreground mt-3">
                Incohérence détectée : l&apos;onglet est synchronisé sur le score principal du bandeau.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border card-neutral rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score global</p>
            </div>
            <div className="flex items-end gap-3 mt-3">
              <p className="text-3xl font-bold">{score || "—"}</p>
              <p className="text-sm text-muted-foreground mb-1">/10</p>
            </div>
            <Progress value={typeof score === "number" ? score * 10 : 0} className="h-2 mt-2" />
            <p className="text-xs text-muted-foreground mt-2">Aligné sur le score du bandeau en haut de page.</p>
          </CardContent>
        </Card>

        <Card className="border-border card-neutral rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lecture pour votre ESN</p>
            </div>
            {summaryBullets.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {summaryBullets.slice(0, 3).map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-bellum-success mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{b}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground mt-3">Complétez votre profil ESN pour une lecture encore plus personnalisée.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Factors table */}
      {factors.length > 0 && (
        <Card className="border-border card-neutral rounded-xl">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-2">
              <BarChart2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <h3 className="font-display text-sm font-semibold">Facteurs du score</h3>
                <p className="text-xs text-muted-foreground mt-1">Décomposition : ce qui tire le score vers le haut (ou vers le bas) et pourquoi. Utilisez ces critères pour affiner votre décision.</p>
              </div>
            </div>

            <div className="table-premium-wrapper">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Facteur</TableHead>
                    <TableHead className="text-xs font-semibold w-24">Score</TableHead>
                    <TableHead className="text-xs font-semibold">Justification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factors.map((f) => (
                    <TableRow key={f.key} className="table-row-hover">
                      <TableCell className="align-top">
                        <div className="flex items-start gap-2">
                          {f.Icon && <f.Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <div>
                            <div className="text-sm font-medium">{f.label}</div>
                            <div className="text-xs text-muted-foreground">{f.hint}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{f.score ?? "—"}</span>
                          <div className="h-2 w-16 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full bg-foreground/70" style={{ width: `${Math.max(0, Math.min(10, f.score ?? 0)) * 10}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <p className="text-sm text-foreground/85 whitespace-pre-line">{f.justification && f.justification !== "—" ? f.justification : "—"}</p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comment ouvrir ce compte — intégré dans Scoring business */}
      {(ouvrir?.strategy || entryPoints.length > 0) && (
        <Card className="border-border card-neutral rounded-xl border-primary/20">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" />
              <h3 className="font-display text-base font-semibold">Comment ouvrir ce compte</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Stratégie d&apos;entrée et portes d&apos;entrée recommandées pour ce compte, en cohérence avec le score et votre profil ESN.
            </p>
            {ouvrir?.strategy != null && safeString(ouvrir.strategy) !== "—" && (
              <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Stratégie d&apos;entrée
                </p>
                <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                  {safeString(ouvrir.strategy)}
                </p>
              </div>
            )}
            {entryPoints.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Portes d&apos;entrée recommandées
                </p>
                <ul className="space-y-3">
                  {entryPoints.map((ep: unknown, i: number) => {
                    const e = ep && typeof ep === "object" ? ep as { label?: unknown; targetProfile?: unknown; justification?: unknown; angle?: unknown; risks?: unknown; planB?: unknown } : {};
                    return (
                      <li key={i} className="flex gap-3 rounded-lg border border-border bg-card p-4">
                        <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-1.5 min-w-0">
                          <p className="text-sm font-medium">{safeString(e.label)}</p>
                          {e.targetProfile != null && (
                            <p className="text-xs text-muted-foreground"><span className="font-medium">Profil cible :</span> {safeString(e.targetProfile)}</p>
                          )}
                          {e.justification != null && (
                            <p className="text-sm text-foreground/85 whitespace-pre-line">{safeString(e.justification)}</p>
                          )}
                          {e.angle != null && (
                            <p className="text-xs text-muted-foreground"><span className="font-medium">Angle :</span> {safeString(e.angle)}</p>
                          )}
                          {(e.risks != null || e.planB != null) && (
                            <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
                              {e.risks != null && <span><span className="font-medium">Risques :</span> {safeString(e.risks)}</span>}
                              {e.planB != null && <span><span className="font-medium">Plan B :</span> {safeString(e.planB)}</span>}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main justification */}
      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-semibold">Justification détaillée</h3>
          </div>
          <p className="text-xs text-muted-foreground">Synthèse des éléments qui fondent le score et la recommandation.</p>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
              {finalJustification}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recommendation */}
      {finalRecommendation && finalRecommendation !== "—" && (
        <Card className="border-border card-neutral rounded-xl border-primary/10">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-semibold">Recommandation d&apos;action</h3>
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">{finalRecommendation}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-semibold">ESN déjà (probablement) en place</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Liste d&apos;ESN qui semblent déjà intervenir sur ce compte (ou l&apos;avoir fait). Objectif : créer des synergies, sous-traitance ou co-traitance au lieu d&apos;arriver en frontal. Les prochaines analyses enrichiront cette section.
          </p>
          {esnSynergies.length > 0 ? (
            <div className="table-premium-wrapper">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">ESN</TableHead>
                    <TableHead className="text-xs font-semibold w-24">Certitude</TableHead>
                    <TableHead className="text-xs font-semibold">Pourquoi</TableHead>
                    <TableHead className="text-xs font-semibold">Conseil pour vous</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {esnSynergies.map((e, i) => (
                    <TableRow key={i} className="table-row-hover align-top">
                      <TableCell className="text-sm font-medium">{safeString(e.name)}</TableCell>
                      <TableCell className="text-sm">
                        {typeof e.certainty === "number" ? `${Math.round(e.certainty)} %` : "—"}
                        {e.presenceType && (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {safeString(e.presenceType)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-pre-line">
                        {safeString(e.why)}
                      </TableCell>
                      <TableCell className="text-sm text-foreground/90 whitespace-pre-line">
                        {safeString(e.adviceForUser)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm text-muted-foreground">Aucune ESN partenaire identifiée pour ce compte.</p>
              <p className="text-xs text-muted-foreground mt-1">Relancez une analyse pour que l&apos;IA recherche des ESN déjà en place (référencement, partenariats, annonces).</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Normalise les semaines du plan (backend peut renvoyer phases avec name/actions ou weeks avec week/title/items)
function normalizePlanWeeks(weeks: unknown): { week: number; title: string; items: { text: string; responsable?: string; outil?: string; deadline?: string; kpi?: string }[] }[] {
  const raw = Array.isArray(weeks) ? weeks : [];
  if (raw.length === 0) return [];
  return raw.map((w: any, i: number) => {
    const title = w.title ?? w.name ?? w.timeframe ?? `Phase ${i + 1}`;
    const actionsOrItems = w.actions ?? w.items ?? [];
    const items = actionsOrItems.map((a: any) => ({
      text: a.text ?? a.action ?? "",
      responsable: a.responsable ?? a.contact,
      outil: a.outil ?? a.channel,
      deadline: a.deadline,
      kpi: a.kpi,
    }));
    return { week: typeof w.week === "number" ? w.week : i + 1, title: String(title), items };
  });
}

function TabPlan({ angles, actionPlan }: { angles: AttackAngle[]; actionPlan: ActionPlan | null }) {
  const weeksList = normalizePlanWeeks(actionPlan?.weeks ?? []);

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Les messages (email, LinkedIn, relance) sont prêts dans l&apos;onglet <strong>Messages</strong>. Ce plan indique qui contacter, quand et dans quel ordre.
      </p>
      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Stratégie recommandée : {actionPlan?.strategy_type || "—"}
          </p>
          <p className="text-sm text-foreground/80">&ldquo;{actionPlan?.strategy_justification || "—"}&rdquo;</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-display text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />{angles.length} angle{angles.length > 1 ? "s" : ""} d&apos;attaque
        </h3>
        {angles.map((angle) => (
          <Card key={angle.id} className={`border-border card-neutral rounded-xl ${angle.is_recommended ? "ring-1 ring-border" : ""}`}>
            <CardContent className="p-6 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />{angle.title}
                </h4>
                {angle.is_recommended && <Badge variant="secondary" className="text-[10px]">★ Recommandé</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{angle.description || "—"}</p>
              <p className="text-xs text-muted-foreground italic">{angle.entry_point || "—"}</p>
            </CardContent>
          </Card>
        ))}
        {angles.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-sm font-semibold">Plan d&apos;action</h3>
        {weeksList.map((week) => (
          <Card key={`${week.week}-${week.title}`} className="border-border card-neutral rounded-xl">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {week.week} — {week.title}
              </p>
              <div className="space-y-2">
                {week.items.map((item, i) => {
                  const hasMeta = item.responsable || item.outil || item.deadline || item.kpi;
                  return (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <Checkbox className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-foreground/80">{item.text || "—"}</span>
                        {hasMeta && (
                          <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                            {item.responsable && <span>Responsable : {item.responsable}</span>}
                            {item.outil && <span>Outil : {item.outil}</span>}
                            {item.deadline && <span>Deadline : {item.deadline}</span>}
                            {item.kpi && <span>KPI : {item.kpi}</span>}
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
        {weeksList.length === 0 && <p className="text-sm text-muted-foreground">Aucun plan d&apos;action enregistré pour ce compte.</p>}
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
      <div>
        <p className="text-sm font-medium text-foreground">Messages prêts à envoyer</p>
        <p className="text-xs text-muted-foreground mt-0.5">Cliquez sur l&apos;icône copier à côté de chaque message, ou sur Gmail pour ouvrir directement.</p>
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
              <Card key={i} className="border-border card-neutral rounded-xl">
                <CardContent className="p-5 space-y-2">
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
  const { account, isLoading: accountLoading, error: accountError, refetch: refetchAccount } = useAccount(id, { refetchWhenAnalyzing: true });
  const { contacts } = useAccountContacts(id);
  const { angles } = useAccountAngles(id);
  const { actionPlan } = useAccountActionPlan(id);
  const cancelAnalysis = useCancelAnalysis();
  const { profile } = useProfile();
  const isProfileReady = profile?.onboarding_completed && profile?.onboarding_data;
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
        <Card className="border-border card-neutral rounded-xl">
          <CardContent className="p-5 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Analyse en cours — vous pouvez suivre l&apos;avancement ici
            </p>
            <p className="text-xs text-muted-foreground">
              La page se met à jour toutes les 2 secondes. Vous pouvez aussi retourner sur Nouvelle recherche pour voir le suivi.
            </p>
            {id && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={async () => {
                  try {
                    await cancelAnalysis(id);
                    await refetchAccount();
                    toast({ title: "Analyse arrêtée", description: "L'analyse a été interrompue." });
                  } catch {
                    toast({ title: "Erreur", description: "Impossible d'arrêter l'analyse.", variant: "destructive" });
                  }
                }}
              >
                Arrêter l&apos;analyse
              </Button>
            )}
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
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="header-premium space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/accounts")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-bold">{account.company_name}</h1>
                {isProfileReady && (
                  <Badge variant="secondary" className="text-[10px] font-normal bg-muted text-muted-foreground border-border">
                    Adapté à votre profil
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{account.sector || "—"}</p>
              {isProfileReady && (
                <p className="text-xs text-muted-foreground/80 mt-0.5">Plan, contacts et messages alignés avec vos critères (secteurs, géo, personas)</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Score :</span>
                <Progress value={account.priority_score * 10} className="w-20 h-2" />
                <PriorityBadge score={account.priority_score} size="sm" />
              </div>
              {account.priority_justification && (
                <p className="text-[10px] text-muted-foreground/90 max-w-xs leading-tight mt-0.5">
                  {typeof account.priority_justification === "string" ? account.priority_justification : (account.priority_justification as { overall?: string })?.overall ?? ""}
                </p>
              )}
            </div>
            <Button
              variant="default"
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
              <Download className="h-3.5 w-3.5 mr-1.5" />Télécharger CSV
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
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />Ouvrir dans Sheets
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="tabs-premium">
      <Tabs defaultValue="fiche">
        <TabsList className="bg-secondary/50 flex-wrap h-auto gap-1.5 p-1.5 rounded-xl">
          <TabsTrigger value="fiche" className="rounded-lg px-4 py-2">Fiche compte</TabsTrigger>
          <TabsTrigger value="contacts" className="rounded-lg px-4 py-2">Contacts ({contactCount})</TabsTrigger>
          <TabsTrigger value="organigramme" className="rounded-lg px-4 py-2">Organigramme</TabsTrigger>
          <TabsTrigger value="plan" className="rounded-lg px-4 py-2">Plan d&apos;action</TabsTrigger>
          <TabsTrigger value="offres" className="rounded-lg px-4 py-2">Offres à construire</TabsTrigger>
          <TabsTrigger value="plan-hebdo" className="rounded-lg px-4 py-2">Plan hebdo</TabsTrigger>
          <TabsTrigger value="evaluation" className="rounded-lg px-4 py-2">Scoring business</TabsTrigger>
          <TabsTrigger value="messages" className="rounded-lg px-4 py-2">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="fiche" className="mt-6"><TabFiche account={account} /></TabsContent>
        <TabsContent value="contacts" className="mt-6"><TabContacts contacts={contacts as Contact[]} companyName={account.company_name} /></TabsContent>
        <TabsContent value="organigramme" className="mt-6"><TabOrganigramme account={account} contacts={contacts as Contact[]} /></TabsContent>
        <TabsContent value="plan" className="mt-6"><TabPlan angles={angles as AttackAngle[]} actionPlan={actionPlan as ActionPlan | null} /></TabsContent>
        <TabsContent value="offres" className="mt-6"><TabOffresConstruire raw={account.raw_analysis} /></TabsContent>
        <TabsContent value="plan-hebdo" className="mt-6"><TabPlanHebdo raw={account.raw_analysis} /></TabsContent>
        <TabsContent value="evaluation" className="mt-6"><TabEvaluation raw={account.raw_analysis} account={account} onboardingData={profile?.onboarding_data} /></TabsContent>
        <TabsContent value="messages" className="mt-6"><TabMessages contacts={contacts as Contact[]} /></TabsContent>
      </Tabs>
      </div>

      {/* Adjust zone */}
      <Card className="border-border card-neutral rounded-xl">
        <CardContent className="p-6 space-y-3">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" />Ajuster la recherche
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
