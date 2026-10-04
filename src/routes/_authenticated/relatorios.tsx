import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BadgeDollarSign, ChartNoAxesCombined, PackageCheck, ReceiptText, RefreshCw } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { brl, fetchItems, fetchPurchaseRecords, fetchSales } from "@/lib/inventory";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Technolife Estoque" },
      { name: "description", content: "Resumo de compras e vendas do estoque." },
      { property: "og:title", content: "Relatórios — Technolife Estoque" },
      { property: "og:description", content: "Custos de compras, vendas e itens mais vendidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Relatorios,
});

type Period = 30 | 90 | 365;

const PERIODS: { value: Period; label: string }[] = [
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 365, label: "365 dias" },
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function StatCard({ icon: Icon, label, value }: { icon: typeof BadgeDollarSign; label: string; value: string }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 text-primary" />
        <span className="text-xs font-medium uppercase">{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Relatorios() {
  const [period, setPeriod] = useState<Period>(30);
  const purchasesQuery = useQuery({ queryKey: ["purchase_records"], queryFn: fetchPurchaseRecords });
  const salesQuery = useQuery({ queryKey: ["sales"], queryFn: fetchSales });
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: fetchItems });

  const purchases = purchasesQuery.data ?? [];
  const sales = salesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const isLoading = purchasesQuery.isLoading || salesQuery.isLoading || itemsQuery.isLoading;
  const isError = purchasesQuery.isError || salesQuery.isError || itemsQuery.isError;

  const cutoff = useMemo(() => {
    const date = startOfDay(new Date());
    date.setDate(date.getDate() - period + 1);
    return date;
  }, [period]);

  const totals = useMemo(() => {
    const periodPurchases = purchases.filter((record) => new Date(record.created_at) >= cutoff);
    const periodSales = sales.filter((sale) => new Date(sale.created_at) >= cutoff);
    return {
      purchases: periodPurchases.reduce((sum, record) => sum + record.total_cost, 0),
      units: periodSales.reduce((sum, sale) => sum + sale.quantity, 0),
      sales: periodSales.length,
    };
  }, [cutoff, purchases, sales]);

  const monthlyPurchases = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      const total = purchases
        .filter((record) => {
          const createdAt = new Date(record.created_at);
          return createdAt >= month && createdAt < nextMonth;
        })
        .reduce((sum, record) => sum + record.total_cost, 0);
      return {
        month: month.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        total,
      };
    });
  }, [purchases]);

  const topItems = useMemo(() => {
    const itemById = new Map(items.map((item) => [item.id, item]));
    const totalsByItem = new Map<string, number>();
    for (const sale of sales) {
      totalsByItem.set(sale.item_id, (totalsByItem.get(sale.item_id) ?? 0) + sale.quantity);
    }
    return [...totalsByItem.entries()]
      .map(([itemId, quantity]) => ({
        name: itemById.get(itemId)?.name ?? "Produto removido",
        quantity,
      }))
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 10);
  }, [items, sales]);

  const retry = () => Promise.all([
    purchasesQuery.refetch(),
    salesQuery.refetch(),
    itemsQuery.refetch(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão simples dos custos de compra e das vendas registradas.</p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1" aria-label="Período dos totais">
          {PERIODS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={period === option.value ? "default" : "ghost"}
              onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-6">
          <p className="text-sm text-destructive">Não foi possível carregar os dados dos relatórios.</p>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="size-4" />
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <div className="panel p-6 text-sm text-muted-foreground">Carregando relatórios...</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={BadgeDollarSign} label={`Compras · ${period} dias`} value={brl(totals.purchases)} />
            <StatCard icon={PackageCheck} label={`Unidades vendidas · ${period} dias`} value={totals.units.toLocaleString("pt-BR")} />
            <StatCard icon={ReceiptText} label={`Número de vendas · ${period} dias`} value={totals.sales.toLocaleString("pt-BR")} />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="panel min-w-0 p-5">
              <div className="flex items-center gap-2 border-b border-border pb-4">
                <ChartNoAxesCombined className="size-5 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Custo de compras por mês</h2>
                  <p className="text-sm text-muted-foreground">Últimos 6 meses</p>
                </div>
              </div>
              <div className="mt-5 h-80" aria-label="Gráfico do custo de compras por mês">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyPurchases} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} width={76} tickFormatter={(value: number) => brl(value).replace(/\u00a0/g, " ")} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                    <Tooltip formatter={(value) => [brl(Number(value)), "Compras"]} cursor={{ fill: "var(--color-muted)" }} />
                    <Bar dataKey="total" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel min-w-0 p-5">
              <div className="flex items-center gap-2 border-b border-border pb-4">
                <PackageCheck className="size-5 text-success" />
                <div>
                  <h2 className="text-lg font-semibold">Itens mais vendidos</h2>
                  <p className="text-sm text-muted-foreground">Top 10 por unidades vendidas</p>
                </div>
              </div>
              {topItems.length === 0 ? (
                <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Nenhuma venda registrada ainda.</div>
              ) : (
                <div className="mt-5 h-80" aria-label="Gráfico dos itens mais vendidos">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topItems} layout="vertical" margin={{ top: 0, right: 16, left: 12, bottom: 0 }}>
                      <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                      <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickFormatter={(name: string) => name.length > 20 ? `${name.slice(0, 18)}…` : name} />
                      <Tooltip formatter={(value) => [`${Number(value).toLocaleString("pt-BR")} unidade(s)`, "Vendas"]} cursor={{ fill: "var(--color-muted)" }} />
                      <Bar dataKey="quantity" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
