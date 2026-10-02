import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeDollarSign, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchItems, fetchSales } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({ meta: [
    { title: "Vendas — Technolife Estoque" },
    { name: "description", content: "Registre vendas e desconte produtos finais do estoque." },
    { property: "og:title", content: "Vendas — Technolife Estoque" },
    { property: "og:description", content: "Baixa de produtos finais e histórico de vendas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Vendas,
});

function Vendas() {
  const qc = useQueryClient();
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const salesQuery = useQuery({ queryKey: ["sales"], queryFn: fetchSales });
  const items = itemsQuery.data ?? [];
  const products = items.filter((item) => item.item_type === "produto");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const selected = products.find((item) => item.id === itemId);

  const sell = useMutation({
    mutationFn: async () => {
      const amount = Number(qty);
      if (!itemId || !Number.isInteger(amount) || amount <= 0) throw new Error("Informe uma quantidade inteira maior que zero.");
      const { error } = await supabase.rpc("record_sale", { p_item_id: itemId, p_qty: amount, ...(note.trim() ? { p_note: note.trim() } : {}) });
      if (error) throw error;
    },
    onSuccess: async () => {
      setQty("1"); setNote("");
      await Promise.all([qc.invalidateQueries({ queryKey: ["items"] }), qc.invalidateQueries({ queryKey: ["sales"] }), qc.invalidateQueries({ queryKey: ["movements", itemId] })]);
      toast.success("Venda registrada e estoque atualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const itemById = new Map(items.map((item) => [item.id, item]));
  const sales = salesQuery.data ?? [];

  return <div className="space-y-8">ól
    <div><h1 className="text-3xl font-bold">Vendas</h1><p className="mt-1 text-sm text-muted-foreground">Dê baixa em produtos finais vendidos e mantenha o histórico.</p></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <form className="panel space-y-5 p-6" onSubmit={(event) => { event.preventDefault(); sell.mutate(); }}>
        <div className="flex items-center gap-2 border-b border-border pb-4"><BadgeDollarSign className="size-5 text-primary" /><h2 className="text-lg font-semibold">Registrar saída</h2></div>
        <div className="space-y-2"><Label>Produto final</Label><Select value={itemId} onValueChange={setItemId}><SelectTrigger><SelectValue placeholder="Selecione o produto vendido" /></SelectTrigger><SelectContent>{products.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="sale-qty">Quantidade vendida</Label><Input id="sale-qty" type="number" min={1} max={selected?.quantity} step={1} value={qty} onChange={(event) => setQty(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="sale-note">Observação</Label><Input id="sale-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Pedido, cliente ou referência opcional" /></div>
        <Button type="submit" disabled={!itemId || sell.isPending}><BadgeDollarSign />{sell.isPending ? "Registrando..." : "Registrar venda"}</Button>
      </form>
      <aside className="panel p-5"><p className="text-xs font-medium uppercase text-muted-foreground">Disponível para venda</p><p className="mt-2 font-display text-4xl font-bold">{selected?.quantity ?? "—"}</p>{selected && <p className="mt-1 text-sm text-muted-foreground">{selected.name}</p>}</aside>
    </div>
    <section className="space-y-4">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Histórico de vendas</h2><p className="text-sm text-muted-foreground">As 100 vendas mais recentes.</p></div>{salesQuery.isError && <Button variant="outline" size="sm" onClick={() => salesQuery.refetch()}><RefreshCw />Tentar novamente</Button>}</div>
      <div className="panel overflow-hidden">{salesQuery.isLoading ? <p className="p-6 text-sm text-muted-foreground">Carregando histórico...</p> : salesQuery.isError ? <p className="p-6 text-sm text-destructive">Não foi possível carregar o histórico.</p> : sales.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p> : <div className="divide-y divide-border">{sales.map((sale) => { const item = itemById.get(sale.item_id); return <div key={sale.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="text-sm font-medium">{item?.name ?? "Produto removido"}</p><p className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleString("pt-BR")}{sale.note ? ` · ${sale.note}` : ""}</p></div><p className="font-semibold tabular-nums">{sale.quantity} unidade(s)</p></div>; })}</div>}</div>
    </section>
  </div>;
}