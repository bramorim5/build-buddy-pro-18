import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeDollarSign, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, deleteSaleRecord, fetchItems, fetchSales, updateSaleRecord, type Sale } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState<Sale | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editNote, setEditNote] = useState("");
  const selected = products.find((item) => item.id === itemId);

  const sell = useMutation({
    mutationFn: async () => {
      const amount = Number(qty);
      if (!itemId || !Number.isInteger(amount) || amount <= 0) throw new Error("Informe uma quantidade inteira maior que zero.");
      const price = unitPrice.trim() === "" ? null : Number(unitPrice);
      if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error("Informe um preço válido.");
      const { error } = await supabase.rpc("record_sale", { p_item_id: itemId, p_qty: amount, ...(price === null ? {} : { p_unit_price: price }), ...(note.trim() ? { p_note: note.trim() } : {}) });
      if (error) throw error;
    },
    onSuccess: async () => {
      setQty("1"); setUnitPrice(""); setNote("");
      await Promise.all([qc.invalidateQueries({ queryKey: ["items"] }), qc.invalidateQueries({ queryKey: ["purchase_records"] }), qc.invalidateQueries({ queryKey: ["sales"] }), qc.invalidateQueries({ queryKey: ["movements", itemId] })]);
      toast.success("Venda registrada e estoque atualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const refreshHistory = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["items"] }),
      qc.invalidateQueries({ queryKey: ["purchase_records"] }),
      qc.invalidateQueries({ queryKey: ["sales"] }),
      qc.invalidateQueries({ queryKey: ["movements"] }),
    ]);
  };

  const updateRecord = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Venda não selecionada.");
      const quantity = Number(editQty);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Informe uma quantidade inteira maior que zero.");
      await updateSaleRecord(editing.id, quantity, editNote.trim());
    },
    onSuccess: async () => {
      setEditing(null);
      await refreshHistory();
      toast.success("Venda corrigida e estoque ajustado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteRecord = useMutation({
    mutationFn: async () => {
      if (!deleting) throw new Error("Venda não selecionada.");
      await deleteSaleRecord(deleting.id);
    },
    onSuccess: async () => {
      setDeleting(null);
      await refreshHistory();
      toast.success("Venda excluída e estoque devolvido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openEdit = (sale: Sale) => {
    setEditing(sale);
    setEditQty(String(sale.quantity));
    setEditNote(sale.note ?? "");
  };

  const itemById = new Map(items.map((item) => [item.id, item]));
  const sales = salesQuery.data ?? [];

  return <div className="space-y-8">
    <div><h1 className="text-3xl font-bold">Vendas</h1><p className="mt-1 text-sm text-muted-foreground">Dê baixa em produtos finais vendidos e mantenha o histórico.</p></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <form className="panel space-y-5 p-6" onSubmit={(event) => { event.preventDefault(); sell.mutate(); }}>
        <div className="flex items-center gap-2 border-b border-border pb-4"><BadgeDollarSign className="size-5 text-primary" /><h2 className="text-lg font-semibold">Registrar saída</h2></div>
        <div className="space-y-2"><Label>Produto final</Label><Select value={itemId} onValueChange={setItemId}><SelectTrigger><SelectValue placeholder="Selecione o produto vendido" /></SelectTrigger><SelectContent>{products.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="sale-qty">Quantidade vendida</Label><Input id="sale-qty" type="number" min={1} max={selected?.quantity} step={1} value={qty} onChange={(event) => setQty(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="sale-unit-price">Preço unitário (R$)</Label><Input id="sale-unit-price" type="number" min={0} step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="Opcional" /></div>
        <div className="space-y-2"><Label htmlFor="sale-note">Observação</Label><Input id="sale-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Pedido, cliente ou referência opcional" /></div>
        <Button type="submit" disabled={!itemId || sell.isPending}><BadgeDollarSign />{sell.isPending ? "Registrando..." : "Registrar venda"}</Button>
      </form>
      <aside className="panel p-5"><p className="text-xs font-medium uppercase text-muted-foreground">Disponível para venda</p><p className="mt-2 font-display text-4xl font-bold">{selected?.quantity ?? "—"}</p>{selected && <p className="mt-1 text-sm text-muted-foreground">{selected.name}</p>}</aside>
    </div>
    <section className="space-y-4">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Histórico de vendas</h2><p className="text-sm text-muted-foreground">As 100 vendas mais recentes.</p></div>{salesQuery.isError && <Button variant="outline" size="sm" onClick={() => salesQuery.refetch()}><RefreshCw />Tentar novamente</Button>}</div>
      <div className="panel overflow-hidden">{salesQuery.isLoading ? <p className="p-6 text-sm text-muted-foreground">Carregando histórico...</p> : salesQuery.isError ? <p className="p-6 text-sm text-destructive">Não foi possível carregar o histórico.</p> : sales.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p> : <div className="divide-y divide-border">{sales.map((sale) => { const item = itemById.get(sale.item_id); return <div key={sale.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="text-sm font-medium">{item?.name ?? "Produto removido"}</p><p className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleString("pt-BR")} · por {sale.user_name || "usuário"}{sale.note ? ` · ${sale.note}` : ""}</p></div><div className="text-right"><p className="font-semibold tabular-nums">{sale.quantity} unidade(s)</p>{sale.unit_price !== null && <p className="text-sm font-medium tabular-nums text-primary">{brl(sale.unit_price * sale.quantity)}</p>}</div><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Editar venda de ${item?.name ?? "produto"}`} title="Editar venda" onClick={() => openEdit(sale)}><Pencil /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Excluir venda de ${item?.name ?? "produto"}`} title="Excluir venda" onClick={() => setDeleting(sale)}><Trash2 /></Button></div></div>; })}</div>}</div>
    </section>
    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !updateRecord.isPending) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>Corrigir venda</DialogTitle><DialogDescription>O estoque será ajustado pela diferença entre a quantidade anterior e a nova.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); updateRecord.mutate(); }}><div className="space-y-2"><Label htmlFor="edit-sale-qty">Quantidade</Label><Input id="edit-sale-qty" type="number" min={1} step={1} value={editQty} onChange={(event) => setEditQty(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="edit-sale-note">Observação</Label><Input id="edit-sale-note" value={editNote} onChange={(event) => setEditNote(event.target.value)} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={updateRecord.isPending}>Cancelar</Button><Button type="submit" disabled={updateRecord.isPending}>{updateRecord.isPending ? "Salvando..." : "Salvar correção"}</Button></DialogFooter></form></DialogContent></Dialog>
    <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open && !deleteRecord.isPending) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir esta venda?</AlertDialogTitle><AlertDialogDescription>A quantidade vendida será devolvida automaticamente ao estoque do produto.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteRecord.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); deleteRecord.mutate(); }} disabled={deleteRecord.isPending}>{deleteRecord.isPending ? "Excluindo..." : "Excluir e devolver estoque"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}