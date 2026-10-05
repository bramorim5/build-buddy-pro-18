import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bomIndex, fetchBom, fetchItems, type BomLine, type Item } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ItemBomSectionProps = { itemId: string; relatedSections: ReactNode };

function BomTree({ parentId, items, byParent, depth = 0, multiplier = 1, seen = new Set<string>() }: { parentId: string; items: Map<string, Item>; byParent: Map<string, BomLine[]>; depth?: number; multiplier?: number; seen?: Set<string> }) {
  const lines = byParent.get(parentId) ?? [];
  if (lines.length === 0) return null;
  return <ul className={cn(depth > 0 && "ml-4 border-l border-border pl-4")}>{lines.map((line) => {
    const child = items.get(line.child_id);
    if (!child) return null;
    const need = (line.quantity || 1) * multiplier;
    const missing = child.quantity < need;
    const loop = seen.has(child.id);
    return <li key={line.id} className="py-1.5"><div className="flex items-center gap-3"><ChevronRight className="size-3 shrink-0 text-muted-foreground" /><Link to="/itens/$id" params={{ id: child.id }} className="min-w-0 flex-1 truncate text-sm hover:underline">{child.name}<span className="text-code ml-2">{child.code}</span></Link><span className="shrink-0 text-xs text-muted-foreground">precisa <b className="text-foreground">{need}</b> · tem <b className={missing ? "text-destructive" : "text-success"}>{child.quantity}</b></span></div>{!loop && <BomTree parentId={child.id} items={items} byParent={byParent} depth={depth + 1} multiplier={need} seen={new Set([...seen, child.id])} />}</li>;
  })}</ul>;
}

export function ItemBomSection({ itemId, relatedSections }: ItemBomSectionProps) {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const { data: bom = [] } = useQuery({ queryKey: ["bom"], queryFn: fetchBom });
  const map = new Map(items.map((item) => [item.id, item]));
  const item = map.get(itemId);
  const { byParent, byChild } = bomIndex(bom);
  const lines = byParent.get(itemId) ?? [];
  const usedIn = byChild.get(itemId) ?? [];
  const [componentOpen, setComponentOpen] = useState(false);
  const [componentId, setComponentId] = useState("");
  const [componentQty, setComponentQty] = useState("1");
  const [componentSearch, setComponentSearch] = useState("");
  const reachesItem = (candidateId: string, targetId: string, visited = new Set<string>()): boolean => {
    if (candidateId === targetId) return true;
    if (visited.has(candidateId)) return false;
    visited.add(candidateId);
    return (byParent.get(candidateId) ?? []).some((line) => reachesItem(line.child_id, targetId, visited));
  };
  const linkedIds = new Set(lines.map((line) => line.child_id));
  const componentOptions = items.filter((candidate) => candidate.id !== itemId && !linkedIds.has(candidate.id) && !reachesItem(candidate.id, itemId));
  const normalizedSearch = componentSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredComponentOptions = normalizedSearch
    ? componentOptions.filter((candidate) => `${candidate.code} ${candidate.name}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch))
    : componentOptions;
  const setBomQty = useMutation({ mutationFn: async ({ lineId, quantity }: { lineId: string; quantity: number }) => { const { error } = await supabase.from("bom_lines").update({ quantity }).eq("id", lineId); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["bom"] }); toast.success("Quantidade da estrutura atualizada"); }, onError: (error: Error) => toast.error(error.message) });
  const addBomLine = useMutation({ mutationFn: async () => { const quantity = Number(componentQty); if (!componentId || !Number.isFinite(quantity) || quantity <= 0) throw new Error("Selecione um componente e informe uma quantidade maior que zero."); const { error } = await supabase.from("bom_lines").insert({ parent_id: itemId, child_id: componentId, quantity }); if (error) throw error; }, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["bom"] }); setComponentId(""); setComponentQty("1"); setComponentSearch(""); setComponentOpen(false); toast.success("Componente adicionado à estrutura"); }, onError: (error: Error) => toast.error(error.message) });
  const removeBomLine = useMutation({ mutationFn: async (lineId: string) => { const { error } = await supabase.from("bom_lines").delete().eq("id", lineId); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["bom"] }); toast.success("Componente retirado da estrutura"); }, onError: (error: Error) => toast.error(error.message) });
  if (!item) return null;

  return <>
    <section className="panel"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4"><div><h2 className="text-base font-semibold">Estrutura</h2><p className="text-sm text-muted-foreground">Componentes diretos e, abaixo de cada um, as próprias submontagens.</p></div><Dialog open={componentOpen} onOpenChange={(open) => { setComponentOpen(open); if (!open) setComponentSearch(""); }}><DialogTrigger asChild><Button size="sm"><Plus />Adicionar componente</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Adicionar à estrutura</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); addBomLine.mutate(); }}><div className="space-y-2"><Label htmlFor="component-search">Pesquisar peça ou submontagem</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="component-search" value={componentSearch} onChange={(event) => { setComponentSearch(event.target.value); setComponentId(""); }} placeholder="Digite o nome ou código" className="pl-9" autoComplete="off" /></div></div><div className="space-y-2"><Label>Peça ou submontagem</Label><Select value={componentId} onValueChange={setComponentId}><SelectTrigger><SelectValue placeholder="Selecione um item" /></SelectTrigger><SelectContent>{filteredComponentOptions.length > 0 ? filteredComponentOptions.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.code} — {candidate.name}</SelectItem>) : <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum componente encontrado</p>}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="component-qty">Quantidade por unidade</Label><Input id="component-qty" type="number" min="0.0001" step="any" value={componentQty} onChange={(event) => setComponentQty(event.target.value)} /></div><Button type="submit" disabled={addBomLine.isPending || !componentId}>{addBomLine.isPending ? "Adicionando..." : "Adicionar componente"}</Button></form></DialogContent></Dialog></header>
      {lines.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground">A estrutura está vazia. Adicione a primeira peça ou submontagem.</p> : <div className="divide-y divide-border">{lines.map((line) => { const child = map.get(line.child_id); if (!child) return null; return <div key={line.id} className="px-5 py-3"><div className="flex flex-wrap items-center gap-3"><Input type="number" min={0.0001} step="any" defaultValue={line.quantity} className="h-9 w-24" onBlur={(event) => { const value = Number(event.target.value); if (value > 0 && value !== line.quantity) setBomQty.mutate({ lineId: line.id, quantity: value }); }} /><span className="text-xs text-muted-foreground">x</span><Link to="/itens/$id" params={{ id: child.id }} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{child.name} <span className="text-code ml-1">{child.code}</span></Link><span className="text-sm text-muted-foreground">em estoque: <b className={child.quantity <= 0 ? "text-destructive" : "text-foreground"}>{child.quantity}</b></span><Button variant="ghost" size="icon" aria-label={`Retirar ${child.name} da estrutura`} onClick={() => removeBomLine.mutate(line.id)} disabled={removeBomLine.isPending}><Trash2 /></Button></div><BomTree parentId={child.id} items={map} byParent={byParent} depth={1} multiplier={line.quantity || 1} seen={new Set([item.id, child.id])} /></div>; })}</div>}
    </section>
    <div className="grid gap-6 lg:grid-cols-2">
      {usedIn.length > 0 && <section className="panel"><header className="border-b border-border px-5 py-4"><h2 className="text-base font-semibold">Usado em</h2></header><div>{usedIn.map((line) => { const parent = map.get(line.parent_id); if (!parent) return null; return <Link key={line.id} to="/itens/$id" params={{ id: parent.id }} className="flex items-center justify-between border-b border-border px-5 py-3 text-sm last:border-0 hover:bg-muted/60"><span className="truncate">{parent.name}</span><span className="text-code shrink-0">{line.quantity}x</span></Link>; })}</div></section>}
      {relatedSections}
    </div>
  </>;
}