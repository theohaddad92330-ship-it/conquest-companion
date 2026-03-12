/**
 * Carte des sites France : SVG métropole + points par ville.
 * Les coordonnées sont en % du viewBox (260 x 300).
 */
import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export type SiteFrance = {
  city?: string;
  region?: string;
  type?: string;
  label?: string;
  importance?: string;
};

// Coordonnées approximatives (x, y) dans viewBox 0 0 260 300 — métropole
const CITY_COORDS: Record<string, { x: number; y: number }> = {
  paris: { x: 138, y: 88 },
  "la défense": { x: 138, y: 88 },
  nanterre: { x: 135, y: 88 },
  courbevoie: { x: 137, y: 87 },
  lyon: { x: 182, y: 192 },
  marseille: { x: 182, y: 268 },
  lille: { x: 130, y: 15 },
  toulouse: { x: 102, y: 278 },
  nice: { x: 218, y: 272 },
  nantes: { x: 55, y: 155 },
  strasbourg: { x: 240, y: 105 },
  montpellier: { x: 152, y: 258 },
  bordeaux: { x: 58, y: 232 },
  rennes: { x: 48, y: 100 },
  reims: { x: 158, y: 68 },
  rouen: { x: 115, y: 62 },
  caen: { x: 95, y: 75 },
  dijon: { x: 178, y: 158 },
  grenoble: { x: 198, y: 218 },
  metz: { x: 218, y: 108 },
  nancy: { x: 210, y: 118 },
  "clermont-ferrand": { x: 142, y: 218 },
  "le havre": { x: 108, y: 55 },
  tours: { x: 118, y: 135 },
  orleans: { x: 128, y: 125 },
  limoges: { x: 118, y: 218 },
  poitiers: { x: 95, y: 195 },
  angers: { x: 72, y: 145 },
  brest: { x: 28, y: 85 },
  aix: { x: 178, y: 262 },
  "aix-en-provence": { x: 178, y: 262 },
  cannes: { x: 212, y: 278 },
  antibes: { x: 215, y: 272 },
  valence: { x: 178, y: 208 },
  besancon: { x: 198, y: 168 },
  mulhouse: { x: 232, y: 168 },
  perpignan: { x: 152, y: 285 },
  pau: { x: 82, y: 268 },
  bayonne: { x: 62, y: 278 },
  la rochelle: { x: 72, y: 218 },
  saint-etienne: { x: 172, y: 202 },
  troyes: { x: 168, y: 108 },
  amiens: { x: 125, y: 45 },
  le mans: { x: 88, y: 125 },
};

function normalizeCity(name: string | undefined): string {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getCoord(city: string | undefined): { x: number; y: number } | null {
  const key = normalizeCity(city);
  if (!key) return null;
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  // Match partiel (ex. "Paris 15" -> paris)
  const partial = Object.keys(CITY_COORDS).find((k) => key.startsWith(k) || key.includes(k));
  return partial ? CITY_COORDS[partial] : null;
}

// Contour simplifié France métropolitaine (path SVG)
const FRANCE_PATH =
  "M 48,98 L 52,158 L 58,232 L 72,268 L 105,298 L 185,295 L 222,282 L 252,248 L 258,185 L 248,105 L 255,28 L 165,12 L 128,22 L 95,55 L 52,75 L 48,98 Z";

const VIEWBOX = "0 0 260 300";

export function FranceSitesMap({
  sites,
  className,
}: {
  sites: SiteFrance[];
  className?: string;
}) {
  const points = useMemo(() => {
    const seen = new Set<string>();
    return sites
      .filter((s) => {
        const c = normalizeCity(s.city);
        if (!c || seen.has(c)) return false;
        seen.add(c);
        return !!getCoord(s.city);
      })
      .map((s) => ({
        ...s,
        coord: getCoord(s.city)!,
      }));
  }, [sites]);

  if (sites.length === 0) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
        <svg
          viewBox={VIEWBOX}
          className="w-full h-auto max-h-[280px] block"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <path
            d={FRANCE_PATH}
            fill="hsl(var(--muted))"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
          />
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.coord.x}
                cy={p.coord.y}
                r={p.importance === "haute" ? 8 : 6}
                fill="hsl(var(--primary))"
                stroke="hsl(var(--background))"
                strokeWidth="1.5"
                opacity={p.importance === "haute" ? 1 : 0.85}
              />
              <title>
                {[p.label || p.city, p.region, p.type].filter(Boolean).join(" · ")}
              </title>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span>
          {points.length} site{points.length > 1 ? "s" : ""} en France
          {points.length < sites.length && ` (${sites.length - points.length} non positionnés sur la carte)`}
        </span>
      </div>
    </div>
  );
}
