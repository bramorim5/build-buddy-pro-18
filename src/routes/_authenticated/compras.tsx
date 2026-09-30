import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, PackagePlus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchItems, fetchSuppliers, fetchItemSuppliers, brl } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Compras — Technolife Estoque" },
      { name: "description", content: "Registre a entrada de componentes comprados no estoque." },
      { property: "og:title", content: "Compras — Technolife Estoque" },
      { property: "og:description", content: "Registre a entrada de componentes comprados no estoque." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Compras,
});

function Compras() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data: links = [] } = useQuery({ queryKey: ["item_suppliers"], queryFn: fetchItemSuppliers });
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [lastEntry, setLastEntry] = useState<{ name: string; qty: number } | null>(null);

  const selected = items.find((i) => i.id === itemId);
  const itemLinks = useMemo(() => links.filter((l) => l.item_id === itemId), [links, itemId]);

  const receive = useMutation({
    mutationFn: async () => {
      const amount = Number(qty);
      if (!itemId || !Number.isInteger(amount) || amount <= 0) throw new Error("Informe uma quantidade inteira maior que zero.");
      const supplier = suppliers.find((s) => s.id === supplierId);
      const details = [supplier ? `Fornecedor: ${supplier.name}` : "", note.trim()].filter(Boolean).join(" · ");
      const { error } = details
        ? await supabase.rpc("receive_purchase", {
            p_item_id: itemId,
            p_qty: amount,
            p_note: details,
          })
        : await supabase.rpc("receive_purchase", {
            p_item_id: itemId,
            p_qty: amount,
          });
      if (error) throw error;
      return amount;
    },
    onSuccess: (amount) => {
      setLastEntry({ name: selected?.name ?? "Item", qty: amount });
      setQty("1");
      setNote("");
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["movements", itemId] });
      toast.success("Compra registrada no estoque");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkedSupplierIds = new Set(itemLinks.map((l) => l.supplier_id));
  const supplierOptions = suppliers.filter((s) => linkedSupplierIds.has(s.id));
  const selectedLink = itemLinks.find((l) => l.supplier_id === supplierId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Registrar compra</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A quantidade entra no estoque imediatamente e fica registrada no histórico.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <form
          className="panel space-y-5 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            receive.mutate();
          }}
        >
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <ShoppingCart className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Entrada de componentes</h2>
          </div>

          <div className="space-y-2">
            <Label>Item comprado</Label>
            <Select
              value={itemId}
              onValueChange={(value) => {
                setItemId(value);
                setSupplierId("");
                setLastEntry(null);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione uma peça ou componente" /></SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchase-qty">Quantidade recebida</Label>
              <Input id="purchase-qty" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={supplierId} onValueChange={setSupplierId} disabled={!itemId || supplierOptions.length === 0}>
                <SelectTrigger><SelectValue placeholder={supplierOptions.length ? "Selecione" : "Sem vínculo cadastrado"} /></SelectTrigger>
                <SelectContent>
                  {supplierOptions.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase-note">Observação</Label>
            <Input id="purchase-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Número do pedido, nota fiscal ou outra referência" />
          </div>

          <Button type="submit" disabled={!itemId || receive.isPending}>
            <PackagePlus className="size-4" />
            {receive.isPending ? "Registrando..." : "Adicionar ao estoque"}
          </Button>
        </form>

        <aside className="space-y-4">
          <div className="panel p-5">
            <p className="text-xs font-medium uppercase text-muted-foreground">Estoque atual</p>
            <p className="mt-2 font-display text-4xl font-bold">{selected?.quantity ?? "—"}</p>
            {selected && <p className="mt-1 text-sm text-muted-foreground">{selected.name}</p>}
          </div>
          {selectedLink && (
            <div className="panel p-5">
              <p className="text-xs font-medium uppercase text-muted-foreground">Último custo cadastrado</p>
              <p className="mt-2 font-display text-2xl font-bold">{brl(selectedLink.unit_cost)}</p>
              {selectedLink.lead_time && <p className="mt-1 text-sm text-muted-foreground">Prazo: {selectedLink.lead_time}</p>}
            </div>
          )}
          {lastEntry && (
            <div className="panel border-success/30 bg-success/5 p-5">
              <CheckCircle2 className="size-5 text-success" />
              <p className="mt-3 text-sm font-medium">{lastEntry.qty} unidade(s) de {lastEntry.name} adicionada(s).</p>
            </div>
          )}
          <Link to="/fornecedores" className="block text-sm text-primary hover:underline">Ver fornecedores cadastrados</Link>
        </aside>
      </div>
    </div>
  );
}