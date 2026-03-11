import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convertit n'importe quelle valeur (raw_analysis, recent_signals, etc.) en string affichable. Évite les crashs. */
export function safeString(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  const o = val as Record<string, unknown>;
  if (o && typeof o === "object") {
    if (typeof o.name === "string") return o.name;
    if (typeof o.signal === "string") return o.signal;
    if (typeof o.overall === "string") return o.overall;
    if (typeof o.title === "string") return o.title;
    if (typeof o.label === "string") return o.label;
  }
  try {
    return String(val);
  } catch {
    return "—";
  }
}
