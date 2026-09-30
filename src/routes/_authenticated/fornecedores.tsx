import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchSuppliers, fetchItemSuppliers, fetchItems } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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

function Fornecedores() {
  const qc = useQueryClient();
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data: links = [] } = useQuery({ queryKey: ["item_suppliers"], queryFn: fetchItemSuppliers });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const term = q.trim().toLowerCase();
  const filtered = suppliers.filter((s) => !term || s.name.toLowerCase().includes(term) || (s.contact ?? "").toLowerCase().includes(term));

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do fornecedor.");
      const { error } = await supabase.from("suppliers").insert({ name: name.trim(), contact: contact.trim() || null, phone: phone.trim() || null, notes: notes.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setName(""); setContact(""); setPhone(""); setNotes(""); setOpen(false);
      toast.success("Fornecedor cadastrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fornecedores</h1>
          <p className="mt-1 text-sm text-muted-foreground">{suppliers.length} fornecedores importados e cadastrados.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" />Novo fornecedor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cadastrar fornecedor</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              <div className="space-y-2"><Label htmlFor="supplier-name">Nome</Label><Input id="supplier-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="supplier-contact">Contato</Label><Input id="supplier-contact" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="supplier-phone">Telefone</Label><Input id="supplier-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="supplier-notes">Observações</Label><Textarea id="supplier-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? "Salvando..." : "Cadastrar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar fornecedor ou contato" className="pl-9" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((supplier) => {
          const supplied = links.filter((l) => l.supplier_id === supplier.id);
          return (
            <article key={supplier.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"><Truck className="size-4" /></span>
                  <div className="min-w-0"><h2 className="truncate text-base font-semibold">{supplier.name}</h2><p className="text-xs text-muted-foreground">{supplied.length} item(ns) fornecido(s)</p></div>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                {supplier.contact && <div><dt className="text-xs text-muted-foreground">Contato</dt><dd>{supplier.contact}</dd></div>}
                {supplier.phone && <div><dt className="text-xs text-muted-foreground">Telefone</dt><dd>{supplier.phone}</dd></div>}
                {supplier.notes && <div><dt className="text-xs text-muted-foreground">Observações</dt><dd className="line-clamp-2">{supplier.notes}</dd></div>}
              </dl>
              {supplied.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">Itens</p>
                  <p className="mt-1 line-clamp-2 text-sm">{supplied.slice(0, 4).map((link) => items.find((i) => i.id === link.item_id)?.name).filter(Boolean).join(", ")}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}