import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, Calendar, Search, Filter, MoreHorizontal,
  ChevronLeft, ChevronRight, RefreshCw, Archive, Trash2,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { useAccounts } from "@/hooks/useAccounts";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };
const PAGE_SIZE = 7;

export default function Accounts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { accounts, isLoading } = useAccounts();
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const displayAccounts: any[] = accounts;
  const sectors = [...new Set(displayAccounts.map((a) => a.sector ?? a.sector).filter(Boolean))];

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let filtered = displayAccounts.filter((a: any) => {
    const company = (a.company_name ?? a.companyName ?? "").toLowerCase();
    const sector = a.sector ?? a.sector;
    const score = a.priority_score ?? a.priorityScore ?? 0;
    const createdAt = a.created_at ?? a.createdAt;

    if (search && !company.includes(search.toLowerCase())) return false;
    if (sectorFilter !== "all" && sector !== sectorFilter) return false;
    if (scoreFilter === "high" && score < 8) return false;
    if (scoreFilter === "medium" && (score < 5 || score > 7)) return false;
    if (scoreFilter === "low" && score > 4) return false;
    if (statusFilter === "ready" && a.status !== "completed") return false;
    if (statusFilter === "analyzing" && a.status !== "analyzing") return false;
    if (dateFilter === "week" && new Date(createdAt) < oneWeekAgo) return false;
    if (dateFilter === "month" && new Date(createdAt) < oneMonthAgo) return false;
    return true;
  });

  filtered = [...filtered].sort((a: any, b: any) => {
    const scoreA = a.priority_score ?? a.priorityScore ?? 0;
    const scoreB = b.priority_score ?? b.priorityScore ?? 0;
    const createdA = a.created_at ?? a.createdAt;
    const createdB = b.created_at ?? b.createdAt;

    if (sortBy === "score") return scoreB - scoreA;
    if (sortBy === "contacts") return (20 + scoreB * 3) - (20 + scoreA * 3);
    return new Date(createdB).getTime() - new Date(createdA).getTime();
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-sm text-muted-foreground">Chargement des comptes...</p>
      </div>
    );
  }

  if (displayAccounts.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <EmptyState type="accounts" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-5 w-5 text-primary" />
              <h1 className="font-display text-xl font-bold">Mes comptes</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {filtered.length} compte{filtered.length > 1 ? "s" : ""}
            </p>
          </div>
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Filtres
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans mes comptes..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-10 bg-card search-glow"
          />
        </div>

        {/* Filter panel */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent>
            <div className="flex flex-wrap items-center gap-3 mb-4 p-4 rounded-lg border border-border bg-card">
              <Select value={sectorFilter} onValueChange={(v) => { setSectorFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px] h-9 bg-background"><SelectValue placeholder="Secteur" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous secteurs</SelectItem>
                  {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={scoreFilter} onValueChange={(v) => { setScoreFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px] h-9 bg-background"><SelectValue placeholder="Score" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous scores</SelectItem>
                  <SelectItem value="high">8-10 (haut)</SelectItem>
                  <SelectItem value="medium">5-7 (moyen)</SelectItem>
                  <SelectItem value="low">1-4 (bas)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px] h-9 bg-background"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="ready">✅ Prêt</SelectItem>
                  <SelectItem value="analyzing">⏳ En cours</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[150px] h-9 bg-background"><SelectValue placeholder="Période" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes dates</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[160px] h-9 bg-background"><SelectValue placeholder="Tri" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Tri par date</SelectItem>
                  <SelectItem value="score">Tri par score</SelectItem>
                  <SelectItem value="contacts">Tri par contacts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.1 }}>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Entreprise</TableHead>
                <TableHead className="text-xs font-semibold">Secteur</TableHead>
                <TableHead className="text-xs font-semibold">Score</TableHead>
                <TableHead className="text-xs font-semibold">Contacts</TableHead>
                <TableHead className="text-xs font-semibold">Statut</TableHead>
                <TableHead className="text-xs font-semibold">Date</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((account, i) => (
                <TableRow
                  key={account.id}
                  className={`cursor-pointer row-hover ${i % 2 !== 0 ? "bg-secondary/20" : ""}`}
                  onClick={() => navigate(`/accounts/${account.id}`)}
                >
                  <TableCell className="font-medium flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {account.company_name ?? account.companyName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{account.sector || "—"}</TableCell>
                  <TableCell><PriorityBadge score={account.priority_score ?? account.priorityScore} size="sm" /></TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{20 + (account.priority_score ?? account.priorityScore) * 3}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {account.status === "completed" ? "✅ Prêt" : "⏳ En cours"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(account.created_at ?? account.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          className="gap-2 text-sm"
                          onClick={() => toast({ title: "Analyse relancée", description: `${account.company_name ?? account.companyName} est en cours de ré-analyse.` })}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />Relancer l&apos;analyse
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 text-sm"
                          onClick={() => toast({ title: "Compte archivé", description: `${account.company_name ?? account.companyName} a été archivé.` })}
                        >
                          <Archive className="h-3.5 w-3.5" />Archiver
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="gap-2 text-sm text-destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="h-3.5 w-3.5" />Supprimer
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer {account.company_name ?? account.companyName} ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Toutes les données liées à ce compte (contacts, messages, plan d'action) seront supprimées.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => toast({ title: "Compte supprimé", description: `${account.company_name ?? account.companyName} a été supprimé.` })}
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Aucun compte trouvé avec ces filtres.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-muted-foreground">
              Affichage {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} sur {filtered.length} comptes
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="gap-1">
                <ChevronLeft className="h-3.5 w-3.5" />Précédent
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="gap-1">
                Suivant<ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
