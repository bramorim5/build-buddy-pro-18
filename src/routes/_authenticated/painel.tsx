import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, PackageX, Boxes, Layers, Factory } from "lucide-react";
import {
  fetchItems,
  fetchBom,
  bomIndex,
  buildableCount,
  stockStatus,
  type Item,
} from "@/lib/inventory";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Technolife Estoque" },
      { name: "description", content: "Alertas de compra e capacidade de produção atual." },
      { property: "og:title", content: "Painel — Technolife Estoque" },
      { property: "og:description", content: "Alertas de compra e capacidade de produção atual." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Boxes;
  label: string;
  value: number | string;
  tone?: "warn" | "bad";
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2">
        <Icon
          className={
            tone === "bad"
              ? "size-4 text-destructive"
              : tone === "warn"
                ? "size-4 text-warning"
                : "size-4 text-primary"
          }
        />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}

function AlertRow({ item }: { item: Item }) {
  const status = stockStatus(item);
  return (
    <Link
      to="/itens/$id"
      params={{ id: item.id }}
      className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 last:border-0 hover:bg-muted/60"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-code">{item.code}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm tabular-nums">
          {item.quantity} <span className="text-muted-foreground">/ mín. {item.min_quantity}</span>
        </span>
        <Badge variant={status === "critico" ? "destructive" : "secondary"}>
          {status === "critico" ? "Zerado" : "Comprar"}
        </Badge>
      </div>
    </Link>
  );
}

function Painel() {
  const { data: items = [], isLoading } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const { data: bom = [] } = useQuery({ queryKey: ["bom"], queryFn: fetchBom });

  const map = new Map(items.map((i) => [i.id, i]));
  const { byParent } = bomIndex(bom);

  const alerts = items
    .filter((i) => stockStatus(i) !== "ok")
    .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name));

  const produtos = items.filter((i) => i.item_type === "produto");

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando estoque...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Painel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Situação do estoque e o que dá para produzir agora.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Boxes} label="Materiais" value={items.filter((i) => i.item_type === "material").length} />
        <Stat
          icon={Layers}
          label="Submontagens"
          value={items.filter((i) => i.item_type === "submontagem").length}
        />
        <Stat icon={Factory} label="Produtos finais" value={produtos.length} />
        {alerts.length ? (
          <Stat icon={AlertTriangle} label="Precisam de compra" value={alerts.length} tone="warn" />
        ) : (
          <Stat icon={AlertTriangle} label="Precisam de compra" value={0} />
        )}
      </div>

      <section className="grid gap-6 lg:grid-cols-5">
        <div className="panel lg:col-span-3">
          <header className="flex items-center gap-2 border-b border-border px-5 py-4">
            <AlertTriangle className="size-4 text-warning" />
            <h2 className="text-base font-semibold">Hora de comprar</h2>
          </header>
          {alerts.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              Nenhum item abaixo do limite. Tudo em ordem.
            </p>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              {alerts.map((i) => (
                <AlertRow key={i.id} item={i} />
              ))}
            </div>
          )}
        </div>

        <div className="panel lg:col-span-2">
          <header className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Factory className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Dá para produzir</h2>
          </header>
          <div>
            {produtos.map((p) => {
              const total = buildableCount(p.id, map, byParent);
              const possivel = total - p.quantity;
              return (
                <Link
                  key={p.id}
                  to="/itens/$id"
                  params={{ id: p.id }}
                  className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 last:border-0 hover:bg-muted/60"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-code">em estoque: {p.quantity}</p>
                  </div>
                  <span
                    className={
                      possivel > 0
                        ? "font-display text-2xl font-bold text-success"
                        : "font-display text-2xl font-bold text-muted-foreground"
                    }
                  >
                    {possivel}
                  </span>
                </Link>
              );
            })}
            {produtos.length === 0 && (
              <p className="px-5 py-8 text-sm text-muted-foreground">
                Nenhum produto final cadastrado.
              </p>
            )}
          </div>
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <PackageX className="mr-1 inline size-3" />
            Cálculo considera fabricar as submontagens que faltarem.
          </p>
        </div>
      </section>
    </div>
  );
}
