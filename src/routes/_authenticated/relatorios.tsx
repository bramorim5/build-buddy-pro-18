import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BadgeDollarSign, ChartNoAxesCombined, PackageCheck, ReceiptText, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type Mode = "quick" | "month";
type QuickPeriod = "30d" | "90d" | "365d" | "6m" | "12m";

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const QUICK_PERIODS: { value: QuickPeriod; label: string }[] = [
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "365d", label: "365 dias" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
];
const MONTHS = Array.from({ length: 12 }, (_, month) => ({
  value: String(month + 1),
  label: new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: SAO_PAULO_TIME_ZONE }).format(new Date(Date.UTC(2024, month, 1))),
}));

function saoPauloParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function dateKey(parts: { year: number; month: number; day: number }) {
  return parts.year * 10_000 + parts.month * 100 + parts.day;
}

function monthKey(parts: { year: number; month: number }) {
  return parts.year * 100 + parts.month;
}

function subtractCalendarDays(parts: { year: number; month: number; day: number }, days: number) {
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day - days));
  return { year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: result.getUTCDate() };
}

function subtractCalendarMonths(parts: { year: number; month: number }, months: number) {
  const result = new Date(Date.UTC(parts.year, parts.month - 1 - months, 1));
  return { year: result.getUTCFullYear(), month: result.getUTCMonth() + 1 };
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

function EmptyChart() {
  return <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">Sem dados para este período</div>;
}

function Relatorios() {
  const nowParts = useMemo(() => saoPauloParts(new Date()), []);
  const [mode, setMode] = useState<Mode>("quick");
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>("30d");
  const [selectedMonth, setSelectedMonth] = useState(nowParts.month);
  const [selectedYear, setSelectedYear] = useState(nowParts.year);
  const purchasesQuery = useQuery({ queryKey: ["purchase_records"], queryFn: fetchPurchaseRecords });
  const salesQuery = useQuery({ queryKey: ["sales"], queryFn: fetchSales });
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: fetchItems });

  const purchases = purchasesQuery.data ?? [];
  const sales = salesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const isLoading = purchasesQuery.isLoading || salesQuery.isLoading || itemsQuery.isLoading;
  const isError = purchasesQuery.isError || salesQuery.isError || itemsQuery.isError;

  const years = useMemo(() => {
    const values = new Set<number>([nowParts.year]);
    purchases.forEach((record) => values.add(saoPauloParts(record.created_at).year));
    sales.forEach((sale) => values.add(saoPauloParts(sale.created_at).year));
    return [...values].sort((a, b) => b - a);
  }, [nowParts.year, purchases, sales]);

  const isInPeriod = (createdAt: string) => {
    const parts = saoPauloParts(createdAt);
    if (mode === "month") return parts.year === selectedYear && parts.month === selectedMonth;
    if (quickPeriod.endsWith("d")) {
      const days = Number(quickPeriod.slice(0, -1));
      return dateKey(parts) >= dateKey(subtractCalendarDays(nowParts, days - 1));
    }
    const months = Number(quickPeriod.slice(0, -1));
    return monthKey(parts) >= monthKey(subtractCalendarMonths(nowParts, months - 1));
  };

  const periodPurchases = useMemo(() => purchases.filter((record) => isInPeriod(record.created_at)), [mode, nowParts, purchases, quickPeriod, selectedMonth, selectedYear]);
  const periodSales = useMemo(() => sales.filter((sale) => isInPeriod(sale.created_at)), [mode, nowParts, quickPeriod, sales, selectedMonth, selectedYear]);
  const periodLabel = mode === "month"
    ? `${MONTHS[selectedMonth - 1]?.label ?? "Mês"} de ${selectedYear}`
    : QUICK_PERIODS.find((option) => option.value === quickPeriod)?.label ?? "Período";

  const totals = useMemo(() => ({
    purchases: periodPurchases.reduce((sum, record) => sum + record.total_cost, 0),
    units: periodSales.reduce((sum, sale) => sum + sale.quantity, 0),
    sales: periodSales.length,
  }), [periodPurchases, periodSales]);

  const monthlyPurchases = useMemo(() => {
    const totalsByMonth = new Map<number, number>();
    for (const record of periodPurchases) {
      const parts = saoPauloParts(record.created_at);
      const key = monthKey(parts);
      totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + record.total_cost);
    }
    return [...totalsByMonth.entries()]
      .sort(([a], [b]) => a - b)
      .map(([key, total]) => {
        const year = Math.floor(key / 100);
        const month = key % 100;
        return {
          month: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: SAO_PAULO_TIME_ZONE }).format(new Date(Date.UTC(year, month - 1, 1))).replace(" de ", "/").replace(".", ""),
          total,
        };
      });
  }, [periodPurchases]);

  const topItems = useMemo(() => {
    const itemById = new Map(items.map((item) => [item.id, item]));
    const totalsByItem = new Map<string, number>();
    for (const sale of periodSales) totalsByItem.set(sale.item_id, (totalsByItem.get(sale.item_id) ?? 0) + sale.quantity);
    return [...totalsByItem.entries()]
      .map(([itemId, quantity]) => ({ name: itemById.get(itemId)?.name ?? "Produto removido", quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 10);
  }, [items, periodSales]);

  const retry = () => Promise.all([purchasesQuery.refetch(), salesQuery.refetch(), itemsQuery.refetch()]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão simples dos custos de compra e das vendas registradas.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3" aria-label="Período dos relatórios">
          <div className="min-w-36 space-y-1"><span className="text-xs font-medium text-muted-foreground">Modo</span><Select value={mode} onValueChange={(value) => setMode(value as Mode)}><SelectTrigger aria-label="Modo do período"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="quick">Rápido</SelectItem><SelectItem value="month">Por mês</SelectItem></SelectContent></Select></div>
          {mode === "quick" ? (
            <div className="min-w-36 space-y-1"><span className="text-xs font-medium text-muted-foreground">Período</span><Select value={quickPeriod} onValueChange={(value) => setQuickPeriod(value as QuickPeriod)}><SelectTrigger aria-label="Período rápido"><SelectValue /></SelectTrigger><SelectContent>{QUICK_PERIODS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
          ) : (
            <>
              <div className="min-w-40 space-y-1"><span className="text-xs font-medium text-muted-foreground">Mês</span><Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}><SelectTrigger aria-label="Mês"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((month) => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="min-w-28 space-y-1"><span className="text-xs font-medium text-muted-foreground">Ano</span><Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}><SelectTrigger aria-label="Ano"><SelectValue /></SelectTrigger><SelectContent>{years.map((year) => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select></div>
            </>
          )}
        </div>
      </div>

      {isError ? (
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-6"><p className="text-sm text-destructive">Não foi possível carregar os dados dos relatórios.</p><Button type="button" variant="outline" size="sm" onClick={retry}><RefreshCw className="size-4" />Tentar novamente</Button></div>
      ) : isLoading ? (
        <div className="panel p-6 text-sm text-muted-foreground">Carregando relatórios...</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={BadgeDollarSign} label={`Compras · ${periodLabel}`} value={brl(totals.purchases)} />
            <StatCard icon={PackageCheck} label={`Unidades vendidas · ${periodLabel}`} value={totals.units.toLocaleString("pt-BR")} />
            <StatCard icon={ReceiptText} label={`Número de vendas · ${periodLabel}`} value={totals.sales.toLocaleString("pt-BR")} />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="panel min-w-0 p-5">
              <div className="flex items-center gap-2 border-b border-border pb-4"><ChartNoAxesCombined className="size-5 text-primary" /><div><h2 className="text-lg font-semibold">Custo de compras por mês</h2><p className="text-sm text-muted-foreground">{periodLabel}</p></div></div>
              {monthlyPurchases.length === 0 ? <EmptyChart /> : <div className="mt-5 h-80" aria-label="Gráfico do custo de compras por mês"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyPurchases} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--color-border)" /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} /><YAxis tickLine={false} axisLine={false} width={76} tickFormatter={(value: number) => brl(value).replace(/\u00a0/g, " ")} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} /><Tooltip formatter={(value) => [brl(Number(value)), "Compras"]} cursor={{ fill: "var(--color-muted)" }} /><Bar dataKey="total" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
            </div>

            <div className="panel min-w-0 p-5">
              <div className="flex items-center gap-2 border-b border-border pb-4"><PackageCheck className="size-5 text-success" /><div><h2 className="text-lg font-semibold">Itens mais vendidos</h2><p className="text-sm text-muted-foreground">Top 10 · {periodLabel}</p></div></div>
              {topItems.length === 0 ? <EmptyChart /> : <div className="mt-5 h-80" aria-label="Gráfico dos itens mais vendidos"><ResponsiveContainer width="100%" height="100%"><BarChart data={topItems} layout="vertical" margin={{ top: 0, right: 16, left: 12, bottom: 0 }}><CartesianGrid horizontal={false} stroke="var(--color-border)" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} /><YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickFormatter={(name: string) => name.length > 20 ? `${name.slice(0, 18)}…` : name} /><Tooltip formatter={(value) => [`${Number(value).toLocaleString("pt-BR")} unidade(s)`, "Vendas"]} cursor={{ fill: "var(--color-muted)" }} /><Bar dataKey="quantity" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}