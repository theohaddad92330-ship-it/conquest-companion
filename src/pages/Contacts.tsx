import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  Users,
  Search,
  Filter,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  Building2,
  Mail,
  Phone,
  Linkedin,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const fadeUp = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  linkedin: string;
  source: string;
  importedAt: string;
}

// Demo contacts to show after import
const demoContacts: Contact[] = [
  { id: "1", firstName: "Marie", lastName: "Dupont", email: "m.dupont@socgen.fr", phone: "+33 6 12 34 56 78", company: "Société Générale", role: "DSI", linkedin: "linkedin.com/in/mdupont", source: "CRM Export", importedAt: "2026-03-04" },
  { id: "2", firstName: "Pierre", lastName: "Martin", email: "p.martin@airbus.com", phone: "+33 6 98 76 54 32", company: "Airbus", role: "Directeur IT", linkedin: "linkedin.com/in/pmartin", source: "CRM Export", importedAt: "2026-03-04" },
  { id: "3", firstName: "Sophie", lastName: "Bernard", email: "s.bernard@bnp.fr", phone: "+33 6 55 44 33 22", company: "BNP Paribas", role: "Achats IT", linkedin: "linkedin.com/in/sbernard", source: "CRM Export", importedAt: "2026-03-04" },
  { id: "4", firstName: "Thomas", lastName: "Leroy", email: "t.leroy@sncf.fr", phone: "+33 6 11 22 33 44", company: "SNCF", role: "Responsable Infra", linkedin: "linkedin.com/in/tleroy", source: "CRM Export", importedAt: "2026-03-04" },
  { id: "5", firstName: "Claire", lastName: "Moreau", email: "c.moreau@totalenergies.com", phone: "+33 6 77 88 99 00", company: "TotalEnergies", role: "CDO", linkedin: "linkedin.com/in/cmoreau", source: "CRM Export", importedAt: "2026-03-04" },
];

export default function Contacts() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; duplicates: number } | null>(null);

  const hasContacts = contacts.length > 0;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Format non supporté", description: "Veuillez importer un fichier CSV.", variant: "destructive" });
      return;
    }

    setIsImporting(true);

    // Simulate import processing
    setTimeout(() => {
      setContacts(demoContacts);
      setImportResult({ count: demoContacts.length, duplicates: 1 });
      setIsImporting(false);
      toast({
        title: "Import réussi ✅",
        description: `${demoContacts.length} contacts importés, 1 doublon détecté et fusionné.`,
      });
    }, 2000);
  };

  const handleDeleteAll = () => {
    setContacts([]);
    setImportResult(null);
    toast({ title: "Contacts supprimés", description: "Tous les contacts importés ont été supprimés." });
  };

  const handleExportCSV = () => {
    toast({ title: "Export lancé", description: "Votre fichier CSV enrichi est en cours de téléchargement." });
  };

  // Filtered contacts
  const companies = [...new Set(contacts.map((c) => c.company))];
  const roles = [...new Set(contacts.map((c) => c.role))];

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      `${c.firstName} ${c.lastName} ${c.email} ${c.company} ${c.role}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompany = filterCompany === "all" || c.company === filterCompany;
    const matchesRole = filterRole === "all" || c.role === filterRole;
    return matchesSearch && matchesCompany && matchesRole;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Mes Contacts
            </h1>
            <p className="text-sm text-foreground/50 mt-1">
              Importez vos contacts existants pour enrichir vos analyses de comptes
            </p>
          </div>
          {hasContacts && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Exporter enrichi
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                    Tout supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer tous les contacts ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action supprimera tous vos contacts importés. Les analyses de comptes déjà effectuées ne seront pas affectées.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </motion.div>

        {/* Import zone */}
        <motion.div variants={fadeUp}>
          <Card
            className={`border-2 border-dashed transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : isImporting
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-primary/30"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CardContent className="p-8 text-center">
              {isImporting ? (
                <div className="space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 animate-pulse">
                    <FileSpreadsheet className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Import en cours…</p>
                    <p className="text-xs text-foreground/50 mt-1">Analyse, dédoublonnage et enrichissement de vos contacts</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <Upload className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Glissez-déposez votre fichier CSV ici</p>
                    <p className="text-xs text-foreground/50 mt-1">ou cliquez pour sélectionner un fichier depuis votre ordinateur</p>
                  </div>
                  <div>
                    <label htmlFor="csv-upload">
                      <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" asChild>
                        <span>
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                          Sélectionner un CSV
                        </span>
                      </Button>
                    </label>
                    <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {["Nom", "Prénom", "Email", "Téléphone", "Entreprise", "Poste", "LinkedIn"].map((col) => (
                      <Badge key={col} variant="secondary" className="text-xs font-normal">
                        {col}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-foreground/40">
                    Colonnes recommandées ci-dessus. Bellum s'adapte automatiquement aux formats CRM courants (Salesforce, HubSpot, Pipedrive…)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Import result banner */}
        {importResult && (
          <motion.div variants={fadeUp}>
            <Card className="border-bellum-success/20 bg-bellum-success/5">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-bellum-success shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {importResult.count} contacts importés avec succès
                  </p>
                  <p className="text-xs text-foreground/50">
                    {importResult.duplicates} doublon(s) détecté(s) et fusionné(s) automatiquement
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setImportResult(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* How it works */}
        {!hasContacts && (
          <motion.div variants={fadeUp}>
            <div className="grid md:grid-cols-3 gap-4 mt-2">
              {[
                {
                  icon: Upload,
                  title: "1. Importez",
                  desc: "Glissez votre fichier CSV exporté depuis votre CRM ou Drive",
                },
                {
                  icon: UserPlus,
                  title: "2. Enrichissement auto",
                  desc: "Bellum dédoublonne, normalise et enrichit chaque contact avec les données publiques",
                },
                {
                  icon: Building2,
                  title: "3. Intégration aux analyses",
                  desc: "Vos contacts sont automatiquement rattachés aux comptes analysés et à l'organigramme",
                },
              ].map((step) => (
                <Card key={step.title} className="border-border">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <step.icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold">{step.title}</h3>
                    <p className="text-xs text-foreground/50 leading-relaxed">{step.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* Contacts table */}
        {hasContacts && (
          <motion.div variants={fadeUp} className="space-y-4">
            {/* Filters bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={filterCompany} onValueChange={setFilterCompany}>
                  <SelectTrigger className="h-9 w-[160px] text-xs">
                    <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Entreprise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="h-9 w-[140px] text-xs">
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-foreground/50">
              <span>{filtered.length} contact{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}</span>
              <span>•</span>
              <span>{companies.length} entreprise{companies.length > 1 ? "s" : ""}</span>
              <span>•</span>
              <span>{roles.length} rôle{roles.length > 1 ? "s" : ""} différent{roles.length > 1 ? "s" : ""}</span>
            </div>

            {/* Table */}
            <Card className="border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Contact</TableHead>
                    <TableHead className="text-xs font-semibold">Entreprise</TableHead>
                    <TableHead className="text-xs font-semibold">Rôle</TableHead>
                    <TableHead className="text-xs font-semibold">Email</TableHead>
                    <TableHead className="text-xs font-semibold">Téléphone</TableHead>
                    <TableHead className="text-xs font-semibold">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((contact) => (
                    <TableRow key={contact.id} className="row-hover">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                            {contact.firstName[0]}{contact.lastName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{contact.firstName} {contact.lastName}</p>
                            {contact.linkedin && (
                              <a href={`https://${contact.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                <Linkedin className="h-3 w-3" />
                                Profil
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-foreground/40" />
                          <span className="text-sm">{contact.company}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs font-normal">{contact.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-foreground/60">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-foreground/60 font-mono text-xs">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-foreground/40">{contact.source}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
