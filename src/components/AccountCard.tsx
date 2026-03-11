import { motion } from "framer-motion";
import { Users, DollarSign, MapPin, GitBranch, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "@/components/PriorityBadge";
import { AccountAnalysis } from "@/types/account";
import { safeString } from "@/lib/utils";

interface AccountCardProps {
  account: AccountAnalysis | null;
  isLoading: boolean;
}

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

const fadeIn = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export function AccountCard({ account, isLoading }: AccountCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
          <SectionSkeleton />
          <SectionSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (!account) return null;

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn} transition={{ duration: 0.4 }}>
      <Card className="border-border bg-card overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{account.company_name}</h2>
            <p className="text-sm text-muted-foreground">{account.sector || "—"}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <PriorityBadge score={account.priority_score} />
            <span className="text-[10px] text-muted-foreground">/10</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Key metrics */}
          <motion.div
            variants={fadeIn}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 gap-4 md:grid-cols-4"
          >
            <InfoField icon={Users} label="Effectifs" value={account.employees || "—"} />
            <InfoField icon={DollarSign} label="CA" value={account.revenue || "—"} />
            <InfoField icon={MapPin} label="Siège" value={account.headquarters || "—"} />
            <InfoField icon={GitBranch} label="Filiales" value={`${account.subsidiaries?.length || 0} identifiées`} />
          </motion.div>

          {/* Subsidiaries */}
          {(account.subsidiaries?.length || 0) > 0 && (
            <motion.div variants={fadeIn} transition={{ delay: 0.2 }} className="space-y-2.5">
              <SectionTitle icon={GitBranch} title="Filiales pertinentes" />
              <div className="flex flex-wrap gap-1.5">
                {(account.subsidiaries || []).map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">
                    {safeString(s)}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}

          {/* IT Challenges */}
          <motion.div variants={fadeIn} transition={{ delay: 0.3 }} className="space-y-2.5">
            <SectionTitle icon={AlertTriangle} title="Enjeux IT identifiés" />
            <ul className="space-y-1.5">
              {(account.it_challenges || []).map((c: unknown, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {safeString(c)}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Signals */}
          <motion.div variants={fadeIn} transition={{ delay: 0.4 }} className="space-y-2.5">
            <SectionTitle icon={TrendingUp} title="Signaux récents" />
            <ul className="space-y-1.5">
              {(account.recent_signals || []).map((s: string | { signal?: string }, i: number) => {
                const label = typeof s === "string" ? s : (s && typeof s === "object" && "signal" in s ? (s as { signal?: string }).signal : String(s ?? ""));
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-bellum-success" />
                    {label || "—"}
                  </li>
                );
              })}
            </ul>
          </motion.div>

          {/* Score justification */}
          <motion.div
            variants={fadeIn}
            transition={{ delay: 0.5 }}
            className="rounded-lg border border-primary/20 bg-primary/5 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-primary mb-1.5">
              Justification du score
            </p>
            <p className="text-sm text-foreground/80">{typeof account.priority_justification === "string" ? account.priority_justification : (account.priority_justification as { overall?: string } | null)?.overall ?? "—"}</p>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function InfoField({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="text-[11px] uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}
