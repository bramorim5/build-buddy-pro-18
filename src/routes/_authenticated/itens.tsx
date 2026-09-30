import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  fetchItems,
  stockStatus,
  TYPE_LABEL,
  type ItemType,
} from "@/lib/inventory";
import { ItemPhoto } from "@/components/inventory/ItemPhoto";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/itens")({
  head: () => ({
    meta: [
      { title: "Itens — Technolife Estoque" },
      {
        name: "description",
        content: "Todos os materiais, submontagens e produtos com quantidade em estoque.",
      },
      { property: "og:title", content: "Itens — Technolife Estoque" },
      {
        property: "og:description",
        content: "Todos os materiais, submontagens e produtos com quantidade em estoque.",
      },
    ],
  }),
  component: Itens,
});

const filters: Array<{ value: "todos" | ItemType; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "produto", label: "Produtos finais" },
  { value: "submontagem", label: "Submontagens" },
  { value: "material", label: "Materiais" },
];

function Itens() {
  const { data: items = [], isLoading } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const [q, setQ] = useState("");
  const [type, setType] = useState<"todos" | ItemType>("todos");
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (type !== "todos" && i.item_type !== type) return false;
      if (onlyAlerts && stockStatus(i) === "ok") return false;
      if (!term) return true;
      return (
        i.name.toLowerCase().includes(term) ||
        i.code.toLowerCase().includes(term) ||
        (i.product_line ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, q, type, onlyAlerts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Itens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} cadastrados — peças, submontagens e produtos finais.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou código"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setType(f.value)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                type === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setOnlyAlerts((v) => !v)}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              onlyAlerts
                ? "bg-warning text-warning-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            Só alertas
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-10 text-sm text-muted-foreground">Carregando...</p>
        ) : list.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted-foreground">Nenhum item encontrado.</p>
        ) : (
          list.map((i) => {
            const status = stockStatus(i);
            return (
              <Link
                key={i.id}
                to="/itens/$id"
                params={{ id: i.id }}
                className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/60"
              >
                <ItemPhoto path={i.photo_url} alt={i.name} className="size-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.name}</p>
                  <p className="text-code">
                    {i.code}
                    {i.product_line ? ` · ${i.product_line}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                  {TYPE_LABEL[i.item_type]}
                </Badge>
                <div className="w-28 shrink-0 text-right">
                  <span
                    className={cn(
                      "font-display text-lg font-bold tabular-nums",
                      status === "critico" && "text-destructive",
                      status === "baixo" && "text-warning",
                    )}
                  >
                    {i.quantity}
                  </span>
                  <p className="text-xs text-muted-foreground">mín. {i.min_quantity}</p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
