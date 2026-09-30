import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Upload, ChevronRight } from "lucide-react";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/itens_/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do item — Technolife Estoque" },
      { name: "description", content: "Estrutura, fornecedores e movimentações do item." },
      { property: "og:title", content: "Detalhe do item — Technolife Estoque" },
      { property: "og:description", content: "Estrutura, fornecedores e movimentações do item." },
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

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item atualizado");
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
          <div>
            <h1 className="text-3xl font-bold">{item.name}</h1>
            <p className="text-code mt-1">{item.code}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="panel p-4">
              <p className="text-xs uppercase text-muted-foreground">Em estoque</p>
              <p className="font-display text-3xl font-bold">{item.quantity}</p>
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

      {linhas.length > 0 && (
        <section className="panel">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Estrutura</h2>
            <p className="text-sm text-muted-foreground">
              Componentes diretos e, abaixo de cada um, as próprias submontagens.
            </p>
          </header>
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
        </section>
      )}

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
