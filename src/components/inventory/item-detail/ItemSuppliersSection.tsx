import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, fetchItemSuppliers, fetchSuppliers } from "@/lib/inventory";
import { cn } from "@/lib/utils";

type Movement = { id: string; item_id: string; delta: number; kind: string; note: string | null; created_at: string };
export type ItemSuppliersSectionProps = { itemId: string };

export function ItemSuppliersSection({ itemId }: ItemSuppliersSectionProps) {
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data: itemSuppliers = [] } = useQuery({ queryKey: ["item_suppliers"], queryFn: fetchItemSuppliers });
  const { data: movements = [] } = useQuery({
    queryKey: ["movements", itemId],
    queryFn: async () => {
      const { data, error } = await supabase.from("movements").select("id, item_id, delta, kind, note, created_at").eq("item_id", itemId).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as Movement[];
    },
  });
  const linkedSuppliers = itemSuppliers.filter((supplier) => supplier.item_id === itemId);

  return (
    <>
      <section className="panel">
        <header className="border-b border-border px-5 py-4"><h2 className="text-base font-semibold">Fornecedores</h2></header>
        {linkedSuppliers.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">Nenhum fornecedor vinculado.</p> : linkedSuppliers.map((linked) => {
          const supplier = suppliers.find((candidate) => candidate.id === linked.supplier_id);
          return <div key={linked.id} className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 text-sm last:border-0"><div className="min-w-0"><p className="truncate font-medium">{supplier?.name ?? "—"}</p>{linked.lead_time && <p className="text-code">prazo: {linked.lead_time}</p>}</div><span className="shrink-0 tabular-nums">{brl(linked.unit_cost)}</span></div>;
        })}
      </section>
      <section className="panel lg:col-span-2">
        <header className="border-b border-border px-5 py-4"><h2 className="text-base font-semibold">Movimentações</h2></header>
        {movements.length === 0 ? <p className="px-5 py-6 text-sm text-muted-foreground">Sem movimentações ainda.</p> : movements.map((movement) => <div key={movement.id} className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 text-sm last:border-0"><div className="min-w-0"><p className="font-medium capitalize">{movement.kind}</p><p className="text-code">{new Date(movement.created_at).toLocaleString("pt-BR")}{movement.note ? ` · ${movement.note}` : ""}</p></div><span className={cn("shrink-0 font-display text-lg font-bold tabular-nums", movement.delta >= 0 ? "text-success" : "text-destructive")}>{movement.delta > 0 ? "+" : ""}{movement.delta}</span></div>)}
      </section>
    </>
  );
}