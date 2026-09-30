import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchSuppliers, fetchItemSuppliers, fetchItems, brl, type Supplier } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores — Technolife Estoque" },
      { name: "description", content: "Fornecedores e componentes fornecidos para a produção." },
      { property: "og:title", content: "Fornecedores — Technolife Estoque" },
      { property: "og:description", content: "Fornecedores e componentes fornecidos para a produção." },
    ],
  }),
  component: Fornecedores,
});

type SupplierForm = { name: string; contact: string; phone: string; notes: string };
const emptyForm: SupplierForm = { name: "", contact: "", phone: "", notes: "" };

function Fornecedores() {
  const qc = useQueryClient();
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const linksQuery = useQuery({ queryKey: ["item_suppliers"], queryFn: fetchItemSuppliers });
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const suppliers = suppliersQuery.data ?? [];
  const links = linksQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const loading = suppliersQuery.isLoading || linksQuery.isLoading || itemsQuery.isLoading;
  const loadError = suppliersQuery.error ?? linksQuery.error ?? itemsQuery.error;
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [linkSupplier, setLinkSupplier] = useState<Supplier | null>(null);
  const [itemId, setItemId] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [leadTime, setLeadTime] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const term = q.trim().toLowerCase();
  const filtered = suppliers.filter(
    (supplier) =>
      !term ||
      supplier.name.toLowerCase().includes(term) ||
      (supplier.contact ?? "").toLowerCase().includes(term),
  );

  const saveSupplier = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome do fornecedor.");
      const payload = {
        name: form.name.trim(),
        contact: form.contact.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      };
      const result = editing
        ? await supabase.from("suppliers").update(payload).eq("id", editing.id)
        : await supabase.from("suppliers").insert(payload);
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? "Fornecedor atualizado" : "Fornecedor cadastrado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteSupplier = useMutation({
    mutationFn: async (supplierId: string) => {
      if (links.some((link) => link.supplier_id === supplierId)) {
        throw new Error("Retire os itens vinculados antes de excluir este fornecedor.");
      }
      const { error } = await supabase.from("suppliers").delete().eq("id", supplierId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor excluído");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addLink = useMutation({
    mutationFn: async () => {
      if (!linkSupplier || !itemId) throw new Error("Selecione um item.");
      const cost = unitCost.trim() ? Number(unitCost.replace(",", ".")) : null;
      if (cost !== null && (!Number.isFinite(cost) || cost < 0)) throw new Error("Informe um custo válido.");
      const { error } = await supabase.from("item_suppliers").insert({
        supplier_id: linkSupplier.id,
        item_id: itemId,
        unit_cost: cost,
        lead_time: leadTime.trim() || null,
        is_primary: isPrimary,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["item_suppliers"] });
      setItemId("");
      setUnitCost("");
      setLeadTime("");
      setIsPrimary(false);
      toast.success("Item vinculado ao fornecedor");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("item_suppliers").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item_suppliers"] });
      toast.success("Vínculo removido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contact: supplier.contact ?? "",
      phone: supplier.phone ?? "",
      notes: supplier.notes ?? "",
    });
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fornecedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">{suppliers.length} fornecedores importados e cadastrados.</p>
        </div>
        <Button onClick={openCreate}><Plus />Novo fornecedor</Button>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar fornecedor" : "Cadastrar fornecedor"}</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); saveSupplier.mutate(); }}>
            <div className="space-y-2"><Label htmlFor="supplier-name">Nome</Label><Input id="supplier-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="supplier-contact">Contato</Label><Input id="supplier-contact" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="supplier-phone">Telefone</Label><Input id="supplier-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="supplier-notes">Observações</Label><Textarea id="supplier-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
            <Button type="submit" disabled={saveSupplier.isPending}>{saveSupplier.isPending ? "Salvando..." : "Salvar fornecedor"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(linkSupplier)} onOpenChange={(open) => { if (!open) setLinkSupplier(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Itens de {linkSupplier?.name}</DialogTitle></DialogHeader>
          <div className="max-h-64 divide-y divide-border overflow-y-auto border-y border-border">
            {links.filter((link) => link.supplier_id === linkSupplier?.id).map((link) => (
              <div key={link.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{itemMap.get(link.item_id)?.name ?? "Item não encontrado"}</p><p className="text-code">{itemMap.get(link.item_id)?.code} · {brl(link.unit_cost)}{link.lead_time ? ` · ${link.lead_time}` : ""}</p></div>
                {link.is_primary && <span className="text-xs font-medium text-primary">Principal</span>}
                <Button variant="ghost" size="icon" aria-label="Remover vínculo" onClick={() => removeLink.mutate(link.id)}><Trash2 /></Button>
              </div>
            ))}
          </div>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); addLink.mutate(); }}>
            <div className="space-y-2"><Label>Adicionar item</Label><Select value={itemId} onValueChange={setItemId}><SelectTrigger><SelectValue placeholder="Selecione uma peça ou componente" /></SelectTrigger><SelectContent>{items.filter((item) => !links.some((link) => link.supplier_id === linkSupplier?.id && link.item_id === item.id)).map((item) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="supplier-cost">Custo unitário</Label><Input id="supplier-cost" inputMode="decimal" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} placeholder="0,00" /></div><div className="space-y-2"><Label htmlFor="supplier-lead">Prazo</Label><Input id="supplier-lead" value={leadTime} onChange={(event) => setLeadTime(event.target.value)} placeholder="Ex.: 15 dias" /></div></div>
            <div className="flex items-center gap-2"><Checkbox id="supplier-primary" checked={isPrimary} onCheckedChange={(checked) => setIsPrimary(checked === true)} /><Label htmlFor="supplier-primary">Fornecedor principal deste item</Label></div>
            <Button type="submit" disabled={!itemId || addLink.isPending}>{addLink.isPending ? "Vinculando..." : "Vincular item"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar fornecedor ou contato" className="pl-9" />
      </div>

      {loading ? <p className="py-10 text-sm text-muted-foreground">Carregando fornecedores...</p> : loadError ? (
        <div role="alert" className="panel p-6"><p className="font-semibold">Não foi possível carregar os fornecedores.</p><p className="mt-1 text-sm text-muted-foreground">Tente novamente. Se o erro continuar, saia e entre novamente.</p><Button className="mt-4" variant="outline" onClick={() => { suppliersQuery.refetch(); linksQuery.refetch(); itemsQuery.refetch(); }}>Tentar novamente</Button></div>
      ) : filtered.length === 0 ? <p className="py-10 text-sm text-muted-foreground">Nenhum fornecedor encontrado.</p> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((supplier) => {
            const supplied = links.filter((link) => link.supplier_id === supplier.id);
            return (
              <article key={supplier.id} className="panel flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"><Truck /></span><div className="min-w-0"><h2 className="truncate text-base font-semibold">{supplier.name}</h2><p className="text-xs text-muted-foreground">{supplied.length} item(ns) fornecido(s)</p></div></div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label={`Editar ${supplier.name}`} onClick={() => openEdit(supplier)}><Pencil /></Button>
                    <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={`Excluir ${supplier.name}`}><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir {supplier.name}?</AlertDialogTitle><AlertDialogDescription>O fornecedor só pode ser excluído quando não possuir itens vinculados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteSupplier.mutate(supplier.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                  </div>
                </div>
                <dl className="mt-4 flex-1 space-y-2 text-sm">{supplier.contact && <div><dt className="text-xs text-muted-foreground">Contato</dt><dd>{supplier.contact}</dd></div>}{supplier.phone && <div><dt className="text-xs text-muted-foreground">Telefone</dt><dd>{supplier.phone}</dd></div>}{supplier.notes && <div><dt className="text-xs text-muted-foreground">Observações</dt><dd className="line-clamp-2">{supplier.notes}</dd></div>}</dl>
                <Button variant="outline" className="mt-4 w-full" onClick={() => setLinkSupplier(supplier)}>Gerenciar itens</Button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}