import type { AccountAnalysis } from "@/types/account";

export type AccountWithStats = AccountAnalysis & {
  contact_count?: number;
  message_count?: number;
  archived_at?: string | null;
};

export function accountCompanyName(a: any): string {
  return String(a?.company_name ?? a?.companyName ?? "Compte");
}

export function accountScore(a: any): number {
  return Number(a?.priority_score ?? a?.priorityScore ?? 0) || 0;
}

export function accountCreatedAt(a: any): string {
  return String(a?.created_at ?? a?.createdAt ?? "");
}

export function accountContactCount(a: any): number {
  const n = a?.contact_count;
  return typeof n === "number" ? n : 0;
}

export function accountMessageCount(a: any): number {
  const n = a?.message_count;
  return typeof n === "number" ? n : 0;
}

export function accountStatusLabel(a: any): string {
  const st = String(a?.status || "");
  if (st === "completed") return "✅ Prêt";
  if (st === "error") return "⚠️ Erreur";
  if (st === "analyzing" || st === "pending") return "⏳ En cours";
  return "—";
}

