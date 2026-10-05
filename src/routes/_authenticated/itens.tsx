import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Copy, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchItems,
  duplicateItem,
  stockStatus,
  TYPE_LABEL,
  type Item,
  type ItemType,
} from "@/lib/inventory";
import { ItemPhoto } from "@/components/inventory/ItemPhoto";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/itens")({
  head: () => ({
    meta: [
      { title: "Itens — Technolife Estoque" },
      {
        name: "description",
        content: "Todos os materiais, submontagens e produtos com quantidade em estoque.",
      },
      { property: "og:title", content: "Itens — Technolife Estoque" },
      {
        property: "og:description",
        content: "Todos os materiais, submontagens e produtos com quantidade em estoque.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Itens,
});

const filters: Array<{ value: "todos" | ItemType; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "material", label: TYPE_LABEL.material },
  { value: "submontagem", label: TYPE_LABEL.submontagem },
  { value: "produto", label: TYPE_LABEL.produto },
];

function Itens() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const [q, setQ] = useState("");
  const [type, setType] = useState<"todos" | ItemType>("todos");
  const [line, setLine] = useState("todas");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [itemType, setItemType] = useState<ItemType>("material");
  const [productLine, setProductLine] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [minQuantity, setMinQuantity] = useState("10");
  const [duplicateSource, setDuplicateSource] = useState<Item | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateCode, setDuplicateCode] = useState("");

  const createItem = useMutation({
    mutationFn: async () => {
      const initial = Number(quantity);
      const minimum = Number(minQuantity);
      if (!code.trim() || !name.trim()) throw new Error("Informe o código e o nome.");
      if (!Number.isInteger(initial) || initial < 0 || !Number.isInteger(minimum) || minimum < 0) {
        throw new Error("Estoque e limite devem ser números inteiros maiores ou iguais a zero.");
      }
      const productLineValue = productLine.trim();
      const baseInput = {
        p_code: code.trim(),
        p_name: name.trim(),
        p_item_type: itemType,
        p_initial_quantity: initial,
        p_min_quantity: minimum,
      };
      const { data, error } = productLineValue
        ? await supabase.rpc("create_inventory_item", { ...baseInput, p_product_line: productLineValue })
        : await supabase.rpc("create_inventory_item", baseInput);
      if (error) throw error;
      return data;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["items"] });
      setOpen(false);
      toast.success("Item cadastrado");
      navigate({ to: "/itens/$id", params: { id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicate = useMutation({
    mutationFn: () => {
      if (!duplicateSource) throw new Error("Selecione um item para duplicar.");
      if (!duplicateName.trim() || !duplicateCode.trim()) {
        throw new Error("Informe o novo nome e o novo código.");
      }
      return duplicateItem(duplicateSource.id, duplicateName.trim(), duplicateCode.trim());
    },
    onSuccess: async (id) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["items"] }),
        qc.invalidateQueries({ queryKey: ["bom"] }),
      ]);
      setDuplicateSource(null);
      toast.success("Item duplicado");
      navigate({ to: "/itens/$id", params: { id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openDuplicate(item: Item) {
    setDuplicateSource(item);
    setDuplicateName(`Cópia de ${item.name}`);
    setDuplicateCode(`${item.code}-COPY`);
  }

  const productLines = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.product_line?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [items],
  );

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((i) => {
      if (type !== "todos" && i.item_type !== type) return false;
      if (line !== "todas" && i.product_line?.trim() !== line) return false;
      if (onlyAlerts && stockStatus(i) === "ok") return false;
      if (!term) return true;
      return i.name.toLowerCase().includes(term) || i.code.toLowerCase().includes(term);
    });
  }, [items, q, type, line, onlyAlerts]);

  const hasActiveFilters = q.trim() !== "" || type !== "todos" || line !== "todas" || onlyAlerts;

  function clearFilters() {
    setQ("");
    setType("todos");
    setLine("todas");
    setOnlyAlerts(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Itens</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} cadastrados — peças, submontagens e produtos finais.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus />Novo item</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Cadastrar item</DialogTitle></DialogHeader>
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createItem.mutate(); }}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="new-code">Código</Label><Input id="new-code" value={code} onChange={(event) => setCode(event.target.value)} required /></div>
                <div className="space-y-2"><Label>Tipo</Label><Select value={itemType} onValueChange={(value) => setItemType(value as ItemType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="material">Peça / material</SelectItem><SelectItem value="submontagem">Submontagem</SelectItem><SelectItem value="produto">Produto final</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label htmlFor="new-name">Nome</Label><Input id="new-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="new-line">Linha de produto</Label><Input id="new-line" value={productLine} onChange={(event) => setProductLine(event.target.value)} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="new-quantity">Estoque inicial</Label><Input id="new-quantity" type="number" min={0} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="new-min">Limite de aviso</Label><Input id="new-min" type="number" min={0} step={1} value={minQuantity} onChange={(event) => setMinQuantity(event.target.value)} /></div>
              </div>
              <Button type="submit" disabled={createItem.isPending}>{createItem.isPending ? "Cadastrando..." : "Cadastrar item"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou código"
            className="pl-9"
          />
        </div>
          <Select value={line} onValueChange={setLine}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Linha de produto">
              <SelectValue placeholder="Todas as linhas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as linhas</SelectItem>
              {productLines.map((productLineOption) => (
                <SelectItem key={productLineOption} value={productLineOption}>
                  {productLineOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button
              key={f.value}
              type="button"
              size="sm"
              variant={type === f.value ? "default" : "outline"}
              className="h-7 px-2.5 text-xs"
              aria-pressed={type === f.value}
              onClick={() => setType(type === f.value && f.value !== "todos" ? "todos" : f.value)}
            >
              {f.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={onlyAlerts ? "default" : "outline"}
            onClick={() => setOnlyAlerts((v) => !v)}
            className={cn("h-7 px-2.5 text-xs", onlyAlerts && "bg-warning text-warning-foreground hover:bg-warning/90")}
            aria-pressed={onlyAlerts}
          >
            Só alertas
          </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {list.length} de {items.length} itens
            </span>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="panel overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-10 text-sm text-muted-foreground">Carregando...</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-5 py-10">
            <p className="text-sm text-muted-foreground">Nenhum item encontrado com esses filtros</p>
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Limpar filtros
            </Button>
          </div>
        ) : (
          list.map((i) => {
            const status = stockStatus(i);
            return (
              <div key={i.id} className="flex items-center border-b border-border last:border-0 hover:bg-muted/60">
                <Link
                  to="/itens/$id"
                  params={{ id: i.id }}
                  className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3"
                >
                  <ItemPhoto path={i.photo_url} alt={i.name} className="size-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.name}</p>
                    <p className="text-code">
                      {i.code}
                      {i.product_line ? ` · ${i.product_line}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                    {TYPE_LABEL[i.item_type]}
                  </Badge>
                  <div className="w-28 shrink-0 text-right">
                    <span
                      className={cn(
                        "font-display text-lg font-bold tabular-nums",
                        status === "critico" && "text-destructive",
                        status === "baixo" && "text-warning",
                      )}
                    >
                      {i.quantity}
                    </span>
                    <p className="text-xs text-muted-foreground">mín. {i.min_quantity}</p>
                  </div>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mr-3 shrink-0"
                  aria-label={`Duplicar ${i.name}`}
                  title="Duplicar"
                  onClick={() => openDuplicate(i)}
                >
                  <Copy />
                </Button>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={duplicateSource !== null} onOpenChange={(isOpen) => { if (!isOpen) setDuplicateSource(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Duplicar item</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); duplicate.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="duplicate-name">Novo nome</Label>
              <Input id="duplicate-name" value={duplicateName} onChange={(event) => setDuplicateName(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duplicate-code">Novo código</Label>
              <Input id="duplicate-code" value={duplicateCode} onChange={(event) => setDuplicateCode(event.target.value)} required />
            </div>
            <Button type="submit" disabled={duplicate.isPending}>
              <Copy />
              {duplicate.isPending ? "Duplicando..." : "Duplicar item"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
