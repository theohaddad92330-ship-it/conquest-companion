import { useNavigate } from "react-router-dom";
import { Search, Building2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  type: "accounts" | "history" | "search";
}

const config = {
  accounts: {
    icon: Building2,
    title: "Aucun compte analysé",
    description: "Lancez votre première recherche pour commencer à construire votre pipeline.",
    cta: "Lancer une recherche",
    to: "/search",
  },
  history: {
    icon: Clock,
    title: "Aucune recherche effectuée",
    description: "Votre historique de recherches apparaîtra ici une fois votre première analyse lancée.",
    cta: "Lancer une recherche",
    to: "/search",
  },
  search: {
    icon: Search,
    title: "Aucun résultat",
    description: "Essayez avec un autre nom d'entreprise.",
    cta: "Nouvelle recherche",
    to: "/search",
  },
};

export function EmptyState({ type }: EmptyStateProps) {
  const navigate = useNavigate();
  const { icon: Icon, title, description, cta, to } = config[type];

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      <Button onClick={() => navigate(to)} className="btn-press">
        <Search className="h-4 w-4 mr-2" />
        {cta}
      </Button>
    </div>
  );
}
