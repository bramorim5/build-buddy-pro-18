import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PackagePlus, Pencil, RefreshCw, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, deletePurchaseRecord, fetchItems, fetchItemSuppliers, fetchPurchaseRecords, fetchSuppliers, updatePurchaseRecord, type PurchaseRecord } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({ meta: [
    { title: "Compras — Technolife Estoque" },
    { name: "description", content: "Registre entradas e consulte valores pagos nas compras de materiais." },
    { property: "og:title", content: "Compras — Technolife Estoque" },
    { property: "og:description", content: "Entradas de materiais e histórico de valores pagos." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Compras,
});

function Compras() {
  const qc = useQueryClient();
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const linksQuery = useQuery({ queryKey: ["item_suppliers"], queryFn: fetchItemSuppliers });
  const historyQuery = useQuery({ queryKey: ["purchase_records"], queryFn: fetchPurchaseRecords });
  const items = itemsQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const links = linksQuery.data ?? [];
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [supplierId, setSupplierId] = useState("");
  const [valueMode, setValueMode] = useState<"total" | "unit">("total");
  const [paidValue, setPaidValue] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<PurchaseRecord | null>(null);
  const [deleting, setDeleting] = useState<PurchaseRecord | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editUnitCost, setEditUnitCost] = useState("");
  const [editNote, setEditNote] = useState("");

  const selected = items.find((item) => item.id === itemId);
  const amount = Number(qty);
  const value = Number(paidValue.replace(",", "."));
  const calculatedUnit = valueMode === "total" && amount > 0 && Number.isFinite(value) ? value / amount : value;
  const calculatedTotal = valueMode === "unit" && amount > 0 && Number.isFinite(value) ? value * amount : value;
  const itemLinks = useMemo(() => links.filter((link) => link.item_id === itemId), [links, itemId]);
  const linkedSupplierIds = new Set(itemLinks.map((link) => link.supplier_id));
  const supplierOptions = suppliers.filter((supplier) => linkedSupplierIds.has(supplier.id));

  const receive = useMutation({
    mutationFn: async () => {
      if (!itemId || !Number.isInteger(amount) || amount <= 0) throw new Error("Informe uma quantidade inteira maior que zero.");
      if (!Number.isFinite(value) || value < 0 || paidValue.trim() === "") throw new Error("Informe um valor válido.");
      const args = {
        p_item_id: itemId,
        p_qty: amount,
        ...(supplierId ? { p_supplier_id: supplierId } : {}),
        ...(valueMode === "total" ? { p_total_cost: value } : { p_unit_cost: value }),
        ...(note.trim() ? { p_note: note.trim() } : {}),
      };
      const { error } = await supabase.rpc("record_purchase", args);
      if (error) throw error;
    },
    onSuccess: async () => {
      setQty("1"); setPaidValue(""); setNote("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["items"] }),
        qc.invalidateQueries({ queryKey: ["purchase_records"] }),
        qc.invalidateQueries({ queryKey: ["movements", itemId] }),
      ]);
      toast.success("Compra registrada com valor e estoque atualizados");
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
      if (!editing) throw new Error("Compra não selecionada.");
      const quantity = Number(editQty);
      const unitCost = Number(editUnitCost.replace(",", "."));
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Informe uma quantidade inteira maior que zero.");
      if (!Number.isFinite(unitCost) || unitCost < 0 || editUnitCost.trim() === "") throw new Error("Informe um custo unitário válido.");
      await updatePurchaseRecord(editing.id, quantity, unitCost, editNote.trim());
    },
    onSuccess: async () => {
      setEditing(null);
      await refreshHistory();
      toast.success("Compra corrigida e estoque ajustado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteRecord = useMutation({
    mutationFn: async () => {
      if (!deleting) throw new Error("Compra não selecionada.");
      await deletePurchaseRecord(deleting.id);
    },
    onSuccess: async () => {
      setDeleting(null);
      await refreshHistory();
      toast.success("Compra excluída e estoque revertido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openEdit = (record: PurchaseRecord) => {
    setEditing(record);
    setEditQty(String(record.quantity));
    setEditUnitCost(String(record.unit_cost));
    setEditNote(record.note ?? "");
  };

  const history = historyQuery.data ?? [];
  const itemById = new Map(items.map((item) => [item.id, item]));
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

  return <div className="space-y-8">
    <div><h1 className="text-3xl font-bold">Compras</h1><p className="mt-1 text-sm text-muted-foreground">Registre a entrada e o valor efetivamente pago pelo lote ou por peça.</p></div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <form className="panel space-y-5 p-6" onSubmit={(event) => { event.preventDefault(); receive.mutate(); }}>
        <div className="flex items-center gap-2 border-b border-border pb-4"><ShoppingCart className="size-5 text-primary" /><h2 className="text-lg font-semibold">Entrada de materiais</h2></div>
        <div className="space-y-2"><Label>Item comprado</Label><Select value={itemId} onValueChange={(id) => { setItemId(id); setSupplierId(""); }}><SelectTrigger><SelectValue placeholder="Selecione uma peça ou componente" /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="purchase-qty">Quantidade recebida</Label><Input id="purchase-qty" type="number" min={1} step={1} value={qty} onChange={(event) => setQty(event.target.value)} /></div>
          <div className="space-y-2"><Label>Fornecedor</Label><Select value={supplierId} onValueChange={setSupplierId} disabled={!itemId || supplierOptions.length === 0}><SelectTrigger><SelectValue placeholder={supplierOptions.length ? "Selecione" : "Sem vínculo cadastrado"} /></SelectTrigger><SelectContent>{supplierOptions.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-3">
          <Label>Como deseja informar o valor?</Label>
          <div className="flex gap-2"><Button type="button" variant={valueMode === "total" ? "default" : "outline"} onClick={() => setValueMode("total")}>Valor total do lote</Button><Button type="button" variant={valueMode === "unit" ? "default" : "outline"} onClick={() => setValueMode("unit")}>Valor por peça</Button></div>
          <div className="space-y-2"><Label htmlFor="purchase-value">{valueMode === "total" ? "Total pago" : "Valor unitário"}</Label><Input id="purchase-value" type="number" min={0} step="0.01" value={paidValue} onChange={(event) => setPaidValue(event.target.value)} placeholder="0,00" /></div>
          {paidValue && Number.isFinite(value) && <p className="text-sm text-muted-foreground">{valueMode === "total" ? `${brl(calculatedUnit)} por peça` : `${brl(calculatedTotal)} no total`}</p>}
        </div>
        <div className="space-y-2"><Label htmlFor="purchase-note">Observação</Label><Input id="purchase-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Pedido, nota fiscal ou referência" /></div>
        <Button type="submit" disabled={!itemId || !paidValue || receive.isPending}><PackagePlus />{receive.isPending ? "Registrando..." : "Adicionar ao estoque"}</Button>
      </form>
      <aside className="space-y-4"><div className="panel p-5"><p className="text-xs font-medium uppercase text-muted-foreground">Estoque atual</p><p className="mt-2 font-display text-4xl font-bold">{selected?.quantity ?? "—"}</p>{selected && <p className="mt-1 text-sm text-muted-foreground">{selected.name}</p>}</div><Link to="/fornecedores" className="block text-sm text-primary hover:underline">Ver fornecedores cadastrados</Link></aside>
    </div>
    <section className="space-y-4">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Histórico de compras</h2><p className="text-sm text-muted-foreground">As 100 compras mais recentes.</p></div>{historyQuery.isError && <Button variant="outline" size="sm" onClick={() => historyQuery.refetch()}><RefreshCw />Tentar novamente</Button>}</div>
      <div className="panel overflow-hidden">{historyQuery.isLoading ? <p className="p-6 text-sm text-muted-foreground">Carregando histórico...</p> : historyQuery.isError ? <p className="p-6 text-sm text-destructive">Não foi possível carregar o histórico.</p> : history.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Nenhuma compra registrada ainda.</p> : <div className="divide-y divide-border">{history.map((record) => { const item = itemById.get(record.item_id); const supplier = record.supplier_id ? supplierById.get(record.supplier_id) : undefined; return <div key={record.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="text-sm font-medium">{item?.name ?? "Item removido"}</p><p className="text-xs text-muted-foreground">{new Date(record.created_at).toLocaleString("pt-BR")} · {supplier?.name ?? "Sem fornecedor"}{record.note ? ` · ${record.note}` : ""}</p></div><div className="text-left sm:text-right"><p className="font-semibold">{brl(record.total_cost)}</p><p className="text-xs text-muted-foreground">{record.quantity} un. · {brl(record.unit_cost)} cada</p></div><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label={`Editar compra de ${item?.name ?? "item"}`} title="Editar compra" onClick={() => openEdit(record)}><Pencil /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Excluir compra de ${item?.name ?? "item"}`} title="Excluir compra" onClick={() => setDeleting(record)}><Trash2 /></Button></div></div>; })}</div>}</div>
    </section>
    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !updateRecord.isPending) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>Corrigir compra</DialogTitle><DialogDescription>O saldo do item será ajustado apenas pela diferença da quantidade.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); updateRecord.mutate(); }}><div className="space-y-2"><Label htmlFor="edit-purchase-qty">Quantidade</Label><Input id="edit-purchase-qty" type="number" min={1} step={1} value={editQty} onChange={(event) => setEditQty(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="edit-purchase-cost">Custo unitário</Label><Input id="edit-purchase-cost" type="number" min={0} step="0.0001" value={editUnitCost} onChange={(event) => setEditUnitCost(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="edit-purchase-note">Observação</Label><Input id="edit-purchase-note" value={editNote} onChange={(event) => setEditNote(event.target.value)} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={updateRecord.isPending}>Cancelar</Button><Button type="submit" disabled={updateRecord.isPending}>{updateRecord.isPending ? "Salvando..." : "Salvar correção"}</Button></DialogFooter></form></DialogContent></Dialog>
    <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open && !deleteRecord.isPending) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir esta compra?</AlertDialogTitle><AlertDialogDescription>A quantidade desta compra será retirada do estoque. A exclusão será bloqueada se o saldo ficar negativo.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deleteRecord.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); deleteRecord.mutate(); }} disabled={deleteRecord.isPending}>{deleteRecord.isPending ? "Excluindo..." : "Excluir e reverter estoque"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}