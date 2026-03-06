import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Building2, Calendar } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { savedAccounts } from "@/lib/mock-data";
import { EmptyState } from "@/components/EmptyState";
import { useAccounts } from "@/hooks/useAccounts";

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };

export default function History() {
  const navigate = useNavigate();
  const { accounts } = useAccounts();

  const displayAccounts = accounts.length > 0 ? accounts : savedAccounts;
  const sorted = [...displayAccounts].sort(
    (a: any, b: any) => new Date(b.created_at ?? b.createdAt).getTime() - new Date(a.created_at ?? a.createdAt).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <EmptyState type="history" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="font-display text-xl font-bold">Historique</h1>
        </div>
        <p className="text-sm text-muted-foreground">{sorted.length} recherches effectuées</p>
      </motion.div>

      <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ delay: 0.1 }}>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Date</TableHead>
                <TableHead className="text-xs font-semibold">Entreprise</TableHead>
                <TableHead className="text-xs font-semibold">Secteur</TableHead>
                <TableHead className="text-xs font-semibold">Score</TableHead>
                <TableHead className="text-xs font-semibold">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((a, i) => (
                <TableRow
                  key={a.id}
                  className={`cursor-pointer row-hover ${i % 2 !== 0 ? "bg-secondary/20" : ""}`}
                  onClick={() => navigate(`/accounts/${a.id}`)}
                >
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {new Date((a as any).created_at ?? (a as any).createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {(a as any).company_name ?? (a as any).companyName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(a as any).sector || "—"}</TableCell>
                  <TableCell><PriorityBadge score={(a as any).priority_score ?? (a as any).priorityScore} size="sm" /></TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {a.status === "completed" ? "✅ Prêt" : "⏳ En cours"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  );
}
