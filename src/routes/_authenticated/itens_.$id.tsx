import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Upload, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchItems,
  fetchBom,
  fetchSuppliers,
  fetchItemSuppliers,
  bomIndex,
  buildableCount,
  assembleNow,
  stockStatus,
  TYPE_LABEL,
  brl,
  type Item,
  type BomLine,
} from "@/lib/inventory";
import { ItemPhoto, PHOTO_BUCKET } from "@/components/inventory/ItemPhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/itens_/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do item — Technolife Estoque" },
      { name: "description", content: "Estrutura, fornecedores e movimentações do item." },
      { property: "og:title", content: "Detalhe do item — Technolife Estoque" },
      { property: "og:description", content: "Estrutura, fornecedores e movimentações do item." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Detalhe,
});

type Movement = {
  id: string;
  item_id: string;
  delta: number;
  kind: string;
  note: string | null;
  created_at: string;
};

function BomTree({
  parentId,
  items,
  byParent,
  depth = 0,
  multiplier = 1,
  seen = new Set<string>(),
}: {
  parentId: string;
  items: Map<string, Item>;
  byParent: Map<string, BomLine[]>;
  depth?: number;
  multiplier?: number;
  seen?: Set<string>;
}) {
  const lines = byParent.get(parentId) ?? [];
  if (lines.length === 0) return null;

  return (
    <ul className={cn(depth > 0 && "ml-4 border-l border-border pl-4")}>
      {lines.map((line) => {
        const child = items.get(line.child_id);
        if (!child) return null;
        const need = (line.quantity || 1) * multiplier;
        const falta = child.quantity < need;
        const loop = seen.has(child.id);
        return (
          <li key={line.id} className="py-1.5">
            <div className="flex items-center gap-3">
              <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
              <Link
                to="/itens/$id"
                params={{ id: child.id }}
                className="min-w-0 flex-1 truncate text-sm hover:underline"
              >
                {child.name}
                <span className="text-code ml-2">{child.code}</span>
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">
                precisa <b className="text-foreground">{need}</b> · tem{" "}
                <b className={falta ? "text-destructive" : "text-success"}>{child.quantity}</b>
              </span>
            </div>
            {!loop && (
              <BomTree
                parentId={child.id}
                items={items}
                byParent={byParent}
                depth={depth + 1}
                multiplier={need}
                seen={new Set([...seen, child.id])}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Detalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const { data: bom = [] } = useQuery({ queryKey: ["bom"], queryFn: fetchBom });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data: itemSuppliers = [] } = useQuery({
    queryKey: ["item_suppliers"],
    queryFn: fetchItemSuppliers,
  });
  const { data: movements = [] } = useQuery({
    queryKey: ["movements", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movements")
        .select("id, item_id, delta, kind, note, created_at")
        .eq("item_id", id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Movement[];
    },
  });

  const map = new Map(items.map((i) => [i.id, i]));
  const item = map.get(id);
  const { byParent, byChild } = bomIndex(bom);

  const [desc, setDesc] = useState<string | null>(null);
  const [minQty, setMinQty] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [componentOpen, setComponentOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editType, setEditType] = useState<Item["item_type"]>("material");
  const [editLine, setEditLine] = useState("");
  const [componentId, setComponentId] = useState("");
  const [componentQty, setComponentQty] = useState("1");

  const save = useMutation({
    mutationFn: async (patch: Database["public"]["Tables"]["items"]["Update"]) => {
      const { error } = await supabase.from("items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordAdjustment = useMutation({
    mutationFn: async (delta: number) => {
      const { error } = await supabase.rpc("adjust_stock", {
        p_item_id: id,
        p_delta: delta,
        p_note: "Ajuste manual de inventário",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["movements", id] });
      toast.success("Estoque ajustado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setBomQty = useMutation({
    mutationFn: async ({ lineId, quantity }: { lineId: string; quantity: number }) => {
      const { error } = await supabase.from("bom_lines").update({ quantity }).eq("id", lineId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom"] });
      toast.success("Quantidade da estrutura atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addBomLine = useMutation({
    mutationFn: async () => {
      const quantity = Number(componentQty);
      if (!componentId || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Selecione um componente e informe uma quantidade maior que zero.");
      }
      const { error } = await supabase.from("bom_lines").insert({
        parent_id: id,
        child_id: componentId,
        quantity,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["bom"] });
      setComponentId("");
      setComponentQty("1");
      setComponentOpen(false);
      toast.success("Componente adicionado à estrutura");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeBomLine = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase.from("bom_lines").delete().eq("id", lineId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bom"] });
      toast.success("Componente retirado da estrutura");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteItem = useMutation({
    mutationFn: async () => {
      if (linhas.length || usadoEm.length || fornecedores.length || movements.length) {
        throw new Error("Este item possui estrutura, fornecedor ou histórico. Retire esses vínculos antes de excluí-lo.");
      }
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item excluído");
      navigate({ to: "/itens" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file);
      if (error) throw error;
      await save.mutateAsync({ photo_url: path });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio da foto");
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!item) return <p className="text-sm text-muted-foreground">Item não encontrado.</p>;

  const status = stockStatus(item);
  const linhas = byParent.get(item.id) ?? [];
  const usadoEm = byChild.get(item.id) ?? [];
  const fornecedores = itemSuppliers.filter((s) => s.item_id === item.id);
  const podeMontarAgora = assembleNow(item.id, map, byParent);
  const totalPossivel = buildableCount(item.id, map, byParent) - item.quantity;
  const reachesItem = (candidateId: string, targetId: string, visited = new Set<string>()): boolean => {
    if (candidateId === targetId) return true;
    if (visited.has(candidateId)) return false;
    visited.add(candidateId);
    return (byParent.get(candidateId) ?? []).some((line) => reachesItem(line.child_id, targetId, visited));
  };
  const linkedIds = new Set(linhas.map((line) => line.child_id));
  const componentOptions = items.filter(
    (candidate) => candidate.id !== item.id && !linkedIds.has(candidate.id) && !reachesItem(candidate.id, item.id),
  );

  return (
    <div className="space-y-8">
      <Link
        to="/itens"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para itens
      </Link>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <ItemPhoto path={item.photo_url} alt={item.name} className="aspect-square w-full" />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadPhoto(f);
            }}
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            {uploading ? "Enviando..." : "Trocar foto"}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{TYPE_LABEL[item.item_type]}</Badge>
            {item.product_line && <Badge variant="secondary">{item.product_line}</Badge>}
            {status !== "ok" && (
              <Badge variant={status === "critico" ? "destructive" : "default"}>
                {status === "critico" ? "Estoque zerado" : "Abaixo do limite"}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{item.name}</h1>
              <p className="text-code mt-1">{item.code}</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => { setEditName(item.name); setEditCode(item.code); setEditType(item.item_type); setEditLine(item.product_line ?? ""); }}><Pencil />Editar</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Editar item</DialogTitle></DialogHeader>
                  <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate({ name: editName.trim(), code: editCode.trim(), item_type: editType, product_line: editLine.trim() || null }, { onSuccess: () => setEditOpen(false) }); }}>
                    <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="edit-code">Código</Label><Input id="edit-code" value={editCode} onChange={(event) => setEditCode(event.target.value)} required /></div><div className="space-y-2"><Label>Tipo</Label><Select value={editType} onValueChange={(value) => setEditType(value as Item["item_type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="material">Peça / material</SelectItem><SelectItem value="submontagem">Submontagem</SelectItem><SelectItem value="produto">Produto final</SelectItem></SelectContent></Select></div></div>
                    <div className="space-y-2"><Label htmlFor="edit-name">Nome</Label><Input id="edit-name" value={editName} onChange={(event) => setEditName(event.target.value)} required /></div>
                    <div className="space-y-2"><Label htmlFor="edit-line">Linha de produto</Label><Input id="edit-line" value={editLine} onChange={(event) => setEditLine(event.target.value)} /></div>
                    <Button type="submit" disabled={save.isPending || !editName.trim() || !editCode.trim()}>{save.isPending ? "Salvando..." : "Salvar alterações"}</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive" size="icon" aria-label="Excluir item"><Trash2 /></Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir {item.name}?</AlertDialogTitle><AlertDialogDescription>Esta ação é permanente. Itens vinculados a estruturas, fornecedores ou históricos não podem ser excluídos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteItem.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="panel p-4">
              <p className="text-xs uppercase text-muted-foreground">Em estoque</p>
              <p className="font-display text-3xl font-bold">{item.quantity}</p>
              <div className="mt-2 flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={item.quantity <= 0 || recordAdjustment.isPending}
                  onClick={() => recordAdjustment.mutate(-1)}
                  aria-label="Retirar uma unidade"
                >
                  −
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={recordAdjustment.isPending}
                  onClick={() => recordAdjustment.mutate(1)}
                  aria-label="Adicionar uma unidade"
                >
                  +
                </Button>
              </div>
            </div>
            <div className="panel p-4">
              <Label htmlFor="min" className="text-xs uppercase text-muted-foreground">
                Limite de aviso
              </Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id="min"
                  type="number"
                  min={0}
                  value={minQty ?? String(item.min_quantity)}
                  onChange={(e) => setMinQty(e.target.value)}
                  className="h-9"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={minQty === null || Number(minQty) === item.min_quantity}
                  onClick={() => save.mutate({ min_quantity: Number(minQty) })}
                >
                  Salvar
                </Button>
              </div>
            </div>
            {linhas.length > 0 && (
              <div className="panel p-4">
                <p className="text-xs uppercase text-muted-foreground">Dá para produzir</p>
                <p className="font-display text-3xl font-bold text-success">{totalPossivel}</p>
                <p className="text-xs text-muted-foreground">
                  {podeMontarAgora} direto com o que já está pronto
                </p>
              </div>
            )}
          </div>

          <div className="panel p-4">
            <Label htmlFor="desc" className="text-xs uppercase text-muted-foreground">
              Descrição
            </Label>
            <Textarea
              id="desc"
              rows={3}
              className="mt-2"
              placeholder="Detalhes técnicos, medidas, observações de uso..."
              value={desc ?? item.description ?? ""}
              onChange={(e) => setDesc(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              disabled={desc === null || desc === (item.description ?? "")}
              onClick={() => save.mutate({ description: desc })}
            >
              Salvar descrição
            </Button>
          </div>
        </div>
      </div>

      <section className="panel">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
            <div><h2 className="text-base font-semibold">Estrutura</h2><p className="text-sm text-muted-foreground">Componentes diretos e, abaixo de cada um, as próprias submontagens.</p></div>
            <Dialog open={componentOpen} onOpenChange={setComponentOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus />Adicionar componente</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Adicionar à estrutura</DialogTitle></DialogHeader>
                <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); addBomLine.mutate(); }}>
                  <div className="space-y-2"><Label>Peça ou submontagem</Label><Select value={componentId} onValueChange={setComponentId}><SelectTrigger><SelectValue placeholder="Selecione um item" /></SelectTrigger><SelectContent>{componentOptions.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.code} — {candidate.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label htmlFor="component-qty">Quantidade por unidade</Label><Input id="component-qty" type="number" min="0.0001" step="any" value={componentQty} onChange={(event) => setComponentQty(event.target.value)} /></div>
                  <Button type="submit" disabled={addBomLine.isPending || !componentId}>{addBomLine.isPending ? "Adicionando..." : "Adicionar componente"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </header>
          {linhas.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground">A estrutura está vazia. Adicione a primeira peça ou submontagem.</p> : (
          <div className="divide-y divide-border">
            {linhas.map((line) => {
              const child = map.get(line.child_id);
              if (!child) return null;
              return (
                <div key={line.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      type="number"
                      min={0.0001}
                      step="any"
                      defaultValue={line.quantity}
                      className="h-9 w-24"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v > 0 && v !== line.quantity)
                          setBomQty.mutate({ lineId: line.id, quantity: v });
                      }}
                    />
                    <span className="text-xs text-muted-foreground">x</span>
                    <Link
                      to="/itens/$id"
                      params={{ id: child.id }}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                    >
                      {child.name} <span className="text-code ml-1">{child.code}</span>
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      em estoque:{" "}
                      <b className={child.quantity <= 0 ? "text-destructive" : "text-foreground"}>
                        {child.quantity}
                      </b>
                    </span>
                    <Button variant="ghost" size="icon" aria-label={`Retirar ${child.name} da estrutura`} onClick={() => removeBomLine.mutate(line.id)} disabled={removeBomLine.isPending}><Trash2 /></Button>
                  </div>
                  <BomTree
                    parentId={child.id}
                    items={map}
                    byParent={byParent}
                    depth={1}
                    multiplier={line.quantity || 1}
                    seen={new Set([item.id, child.id])}
                  />
                </div>
              );
            })}
          </div>
          )}
        </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {usadoEm.length > 0 && (
          <section className="panel">
            <header className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">Usado em</h2>
            </header>
            <div>
              {usadoEm.map((line) => {
                const parent = map.get(line.parent_id);
                if (!parent) return null;
                return (
                  <Link
                    key={line.id}
                    to="/itens/$id"
                    params={{ id: parent.id }}
                    className="flex items-center justify-between border-b border-border px-5 py-3 text-sm last:border-0 hover:bg-muted/60"
                  >
                    <span className="truncate">{parent.name}</span>
                    <span className="text-code shrink-0">{line.quantity}x</span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="panel">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Fornecedores</h2>
          </header>
          {fornecedores.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nenhum fornecedor vinculado.</p>
          ) : (
            fornecedores.map((f) => {
              const s = suppliers.find((x) => x.id === f.supplier_id);
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s?.name ?? "—"}</p>
                    {f.lead_time && <p className="text-code">prazo: {f.lead_time}</p>}
                  </div>
                  <span className="shrink-0 tabular-nums">{brl(f.unit_cost)}</span>
                </div>
              );
            })
          )}
        </section>

        <section className="panel lg:col-span-2">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Movimentações</h2>
          </header>
          {movements.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Sem movimentações ainda.</p>
          ) : (
            movements.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-medium capitalize">{m.kind}</p>
                  <p className="text-code">
                    {new Date(m.created_at).toLocaleString("pt-BR")}
                    {m.note ? ` · ${m.note}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-display text-lg font-bold tabular-nums",
                    m.delta >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {m.delta > 0 ? "+" : ""}
                  {m.delta}
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
