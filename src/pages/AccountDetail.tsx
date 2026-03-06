import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Download, FileSpreadsheet, Pencil, Building2, Users,
  GitBranch, AlertTriangle, TrendingUp, Target, Mail, Linkedin,
  RotateCw, Phone, ExternalLink, Copy, CheckCircle, Star,
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
                {week.items.map((item, i) => (
                  <label key={i} className="flex items-start gap-2.5 text-sm cursor-pointer">
                    <Checkbox className="mt-0.5" />
                    <span className="text-foreground/80">{item.text}</span>
                  </label>
                ))}
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
  const { account, isLoading: accountLoading, error: accountError } = useAccount(id);
  const { contacts } = useAccountContacts(id);
  const { angles } = useAccountAngles(id);
  const { actionPlan } = useAccountActionPlan(id);
  const [adjustPrompt, setAdjustPrompt] = useState("");

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
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="fiche">Fiche compte</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contactCount})</TabsTrigger>
          <TabsTrigger value="plan">Plan d&apos;action</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="fiche" className="mt-6"><TabFiche account={account} /></TabsContent>
        <TabsContent value="contacts" className="mt-6"><TabContacts contacts={contacts as Contact[]} companyName={account.company_name} /></TabsContent>
        <TabsContent value="plan" className="mt-6"><TabPlan angles={angles as AttackAngle[]} actionPlan={actionPlan as ActionPlan | null} /></TabsContent>
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
