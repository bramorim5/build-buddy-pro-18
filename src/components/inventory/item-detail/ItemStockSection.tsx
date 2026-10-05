import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { assembleNow, bomIndex, buildableCount, fetchBom, fetchItemSuppliers, fetchItems, stockStatus, TYPE_LABEL, type Item } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type Movement = { id: string; item_id: string; delta: number; kind: string; note: string | null; created_at: string };
export type ItemStockSectionProps = { itemId: string };

export function ItemStockSection({ itemId }: ItemStockSectionProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const { data: bom = [] } = useQuery({ queryKey: ["bom"], queryFn: fetchBom });
  const { data: itemSuppliers = [] } = useQuery({ queryKey: ["item_suppliers"], queryFn: fetchItemSuppliers });
  const { data: movements = [] } = useQuery({
    queryKey: ["movements", itemId],
    queryFn: async () => {
      const { data, error } = await supabase.from("movements").select("id, item_id, delta, kind, note, created_at").eq("item_id", itemId).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as Movement[];
    },
  });
  const item = items.find((candidate) => candidate.id === itemId);
  const map = new Map(items.map((candidate) => [candidate.id, candidate]));
  const { byParent, byChild } = bomIndex(bom);
  const lines = byParent.get(itemId) ?? [];
  const usedIn = byChild.get(itemId) ?? [];
  const linkedSuppliers = itemSuppliers.filter((supplier) => supplier.item_id === itemId);
  const [desc, setDesc] = useState<string | null>(null);
  const [minQty, setMinQty] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editType, setEditType] = useState<Item["item_type"]>("material");
  const [editLine, setEditLine] = useState("");

  const save = useMutation({
    mutationFn: async (patch: Database["public"]["Tables"]["items"]["Update"]) => {
      const { error } = await supabase.from("items").update(patch).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["items"] }); toast.success("Item atualizado"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const recordAdjustment = useMutation({
    mutationFn: async (delta: number) => {
      const { error } = await supabase.rpc("adjust_stock", { p_item_id: itemId, p_delta: delta, p_note: "Ajuste manual de inventário" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["items"] }); qc.invalidateQueries({ queryKey: ["movements", itemId] }); toast.success("Estoque ajustado"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteItem = useMutation({
    mutationFn: async () => {
      if (lines.length || usedIn.length || linkedSuppliers.length || movements.length) throw new Error("Este item possui estrutura, fornecedor ou histórico. Retire esses vínculos antes de excluí-lo.");
      const { error } = await supabase.from("items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["items"] }); toast.success("Item excluído"); navigate({ to: "/itens" }); },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!item) return null;
  const status = stockStatus(item);
  const canAssembleNow = assembleNow(item.id, map, byParent);
  const totalPossible = buildableCount(item.id, map, byParent) - item.quantity;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{TYPE_LABEL[item.item_type]}</Badge>
        {item.product_line && <Badge variant="secondary">{item.product_line}</Badge>}
        {status !== "ok" && <Badge variant={status === "critico" ? "destructive" : "default"}>{status === "critico" ? "Estoque zerado" : "Abaixo do limite"}</Badge>}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold">{item.name}</h1><p className="text-code mt-1">{item.code}</p></div>
        <div className="flex gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild><Button variant="outline" onClick={() => { setEditName(item.name); setEditCode(item.code); setEditType(item.item_type); setEditLine(item.product_line ?? ""); }}><Pencil />Editar</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Editar item</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate({ name: editName.trim(), code: editCode.trim(), item_type: editType, product_line: editLine.trim() || null }, { onSuccess: () => setEditOpen(false) }); }}><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="edit-code">Código</Label><Input id="edit-code" value={editCode} onChange={(event) => setEditCode(event.target.value)} required /></div><div className="space-y-2"><Label>Tipo</Label><Select value={editType} onValueChange={(value) => setEditType(value as Item["item_type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="material">Peça / material</SelectItem><SelectItem value="submontagem">Submontagem</SelectItem><SelectItem value="produto">Produto final</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label htmlFor="edit-name">Nome</Label><Input id="edit-name" value={editName} onChange={(event) => setEditName(event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="edit-line">Linha de produto</Label><Input id="edit-line" value={editLine} onChange={(event) => setEditLine(event.target.value)} /></div><Button type="submit" disabled={save.isPending || !editName.trim() || !editCode.trim()}>{save.isPending ? "Salvando..." : "Salvar alterações"}</Button></form></DialogContent>
          </Dialog>
          <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" aria-label="Excluir item"><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir {item.name}?</AlertDialogTitle><AlertDialogDescription>Esta ação é permanente. Itens vinculados a estruturas, fornecedores ou históricos não podem ser excluídos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteItem.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4"><p className="text-xs uppercase text-muted-foreground">Em estoque</p><p className="font-display text-3xl font-bold">{item.quantity}</p><div className="mt-2 flex gap-1"><Button size="sm" variant="outline" disabled={item.quantity <= 0 || recordAdjustment.isPending} onClick={() => recordAdjustment.mutate(-1)} aria-label="Retirar uma unidade">−</Button><Button size="sm" variant="outline" disabled={recordAdjustment.isPending} onClick={() => recordAdjustment.mutate(1)} aria-label="Adicionar uma unidade">+</Button></div></div>
        <div className="panel p-4"><Label htmlFor="min" className="text-xs uppercase text-muted-foreground">Limite de aviso</Label><div className="mt-2 flex gap-2"><Input id="min" type="number" min={0} value={minQty ?? String(item.min_quantity)} onChange={(event) => setMinQty(event.target.value)} className="h-9" /><Button size="sm" variant="secondary" disabled={minQty === null || Number(minQty) === item.min_quantity} onClick={() => save.mutate({ min_quantity: Number(minQty) })}>Salvar</Button></div></div>
        {lines.length > 0 && <div className="panel p-4"><p className="text-xs uppercase text-muted-foreground">Dá para produzir</p><p className="font-display text-3xl font-bold text-success">{totalPossible}</p><p className="text-xs text-muted-foreground">{canAssembleNow} direto com o que já está pronto</p></div>}
      </div>
      <div className="panel p-4"><Label htmlFor="desc" className="text-xs uppercase text-muted-foreground">Descrição</Label><Textarea id="desc" rows={3} className="mt-2" placeholder="Detalhes técnicos, medidas, observações de uso..." value={desc ?? item.description ?? ""} onChange={(event) => setDesc(event.target.value)} /><Button size="sm" variant="secondary" className="mt-3" disabled={desc === null || desc === (item.description ?? "")} onClick={() => save.mutate({ description: desc })}>Salvar descrição</Button></div>
    </div>
  );
}