import { AlertTriangle, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SearchCorrectionBannerProps {
  originalQuery: string;
  correctedName: string | null;
  notFound: boolean;
  suggestions: string[];
  onSuggestionClick: (name: string) => void;
  onDismiss: () => void;
}

export function SearchCorrectionBanner({
  originalQuery,
  correctedName,
  notFound,
  suggestions,
  onSuggestionClick,
  onDismiss,
}: SearchCorrectionBannerProps) {
  if (correctedName && !notFound) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Search className="h-4 w-4 text-primary" />
          <span>
            Résultats pour <strong className="text-foreground">{correctedName}</strong>
          </span>
          <span className="text-muted-foreground">
            — Vous avez cherché &quot;{originalQuery}&quot;
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span>
            Aucune entreprise trouvée pour <strong>&quot;{originalQuery}&quot;</strong>
          </span>
        </div>
        {suggestions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Vous vouliez dire :</span>
            {suggestions.map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => onSuggestionClick(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
