import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LayoutDashboard, Boxes, ShoppingCart, BadgeDollarSign, Wrench, Truck, LogOut, ChartNoAxesCombined } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/logo-technolife.png.asset.json";

const nav = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/itens", label: "Itens", icon: Boxes },
  { to: "/compras", label: "Compras", icon: ShoppingCart },
  { to: "/vendas", label: "Vendas", icon: BadgeDollarSign },
  { to: "/montagem", label: "Montagem", icon: Wrench },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck },
  { to: "/relatorios", label: "Relatórios", icon: ChartNoAxesCombined },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3">
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {nav.map((n) => {
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" />
            Sair
          </button>

          <Link to="/painel" aria-label="Ir para o painel" className="ml-auto shrink-0">
            <img
              src={logoAsset.url}
              alt="Technolife Dental Excellence"
              className="h-9 w-auto max-w-44 object-contain sm:h-10 sm:max-w-52"
            />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
