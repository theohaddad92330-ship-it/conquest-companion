import { useLocation, useNavigate } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Coins, ChevronRight, User, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useCredits } from "@/hooks/useCredits";
import { useAccounts } from "@/hooks/useAccounts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const routeLabels: Record<string, string> = {
  "/search": "Nouvelle recherche",
  "/dashboard": "Dashboard",
  "/accounts": "Mes comptes",
  "/contacts": "Mes contacts",
  "/history": "Historique",
  "/profile": "Mon profil ESN",
  "/billing": "Crédits & plan",
  "/help": "Aide",
};

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { credits, remaining } = useCredits();
  const { accounts } = useAccounts();
  const { signOut, user } = useAuth();
  const { profile } = useProfile();

  let currentLabel = routeLabels[location.pathname] || "Page";
  const accountMatch = location.pathname.match(/^\/accounts\/(.+)$/);
  if (accountMatch) {
    const accountId = accountMatch[1];
    const account = accounts.find((a: any) => a.id === accountId);
    currentLabel = account ? (account.company_name ?? account.companyName) : "Détail compte";
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Utilisateur";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="h-14 flex items-center justify-between border-b border-border px-4 shrink-0 bg-background">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Bellum AI</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          {accountMatch && (
            <>
              <a href="/accounts" className="text-muted-foreground hover:text-foreground transition-colors">Mes comptes</a>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </>
          )}
          <span className="font-medium text-foreground">{currentLabel}</span>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5">
          <Coins className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-mono font-semibold text-foreground">{remaining}</span>
          <span className="text-xs text-muted-foreground">crédits</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20">
              <span className="text-xs font-semibold text-primary">{initials}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2 cursor-pointer">
              <Settings className="h-4 w-4" />
              Mon profil ESN
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/billing")} className="gap-2 cursor-pointer">
              <Coins className="h-4 w-4" />
              Crédits & plan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
