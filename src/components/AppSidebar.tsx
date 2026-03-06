import {
  Search, Building2, LayoutDashboard, Clock, Settings,
  Coins, HelpCircle, LogOut, Zap, Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useCredits } from "@/hooks/useCredits";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
  SidebarFooter, SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Mes comptes", url: "/accounts", icon: Building2 },
  { title: "Mes contacts", url: "/contacts", icon: Users },
  { title: "Historique", url: "/history", icon: Clock },
];

const settingsNav = [
  { title: "Mon profil ESN", url: "/profile", icon: Settings },
  { title: "Crédits & plan", url: "/billing", icon: Coins },
];

const bottomNav = [
  { title: "Aide", url: "/help", icon: HelpCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { credits: userCredits, usagePercent, remaining } = useCredits();
  const total = userCredits?.accounts_limit ?? 3;
  const { signOut, user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-base font-display font-bold tracking-tight text-foreground">
              Bellum AI
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-3 mb-1">
          <NavLink to="/search" end className="w-full" activeClassName="">
            <Button
              variant="default"
              className="w-full justify-start gap-2.5 h-9 text-sm font-semibold"
              size={collapsed ? "icon" : "default"}
            >
              <Search className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Nouvelle recherche</span>}
            </Button>
          </NavLink>
        </div>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-accent/10 hover:text-foreground nav-glow" activeClassName="bg-primary/10 text-primary font-medium border-l-[3px] border-primary">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-2" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-accent/10 hover:text-foreground nav-glow" activeClassName="bg-primary/10 text-primary font-medium border-l-[3px] border-primary">
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        <SidebarMenu>
          {bottomNav.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink to={item.url} end className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground" activeClassName="bg-primary/10 text-primary font-medium">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer">
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Déconnexion</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* User info */}
        {!collapsed && displayName && (
          <div className="rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <span className="text-[10px] font-semibold text-primary">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        )}

        {/* Credits */}
        {!collapsed && (
          <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground">Crédits</span>
              </div>
              <span className="text-xs font-mono font-semibold text-foreground">{remaining}/{total}</span>
            </div>
            <Progress value={usagePercent} className="h-1.5" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
