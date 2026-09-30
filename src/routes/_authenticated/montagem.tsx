import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Factory, Wrench, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchItems, fetchBom, bomIndex, assembleNow } from "@/lib/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/montagem")({
  head: () => ({
    meta: [
      { title: "Montagem — Technolife Estoque" },
      { name: "description", content: "Monte submontagens e produtos com baixa automática dos componentes." },
      { property: "og:title", content: "Montagem — Technolife Estoque" },
      { property: "og:description", content: "Monte submontagens e produtos com baixa automática dos componentes." },
    ],
  }),
  component: Montagem,
});

function Montagem() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  const { data: bom = [] } = useQuery({ queryKey: ["bom"], queryFn: fetchBom });
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [completed, setCompleted] = useState<string | null>(null);
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const { byParent } = bomIndex(bom);
  const candidates = items.filter((i) => (byParent.get(i.id)?.length ?? 0) > 0);
  const selected = itemMap.get(itemId);
  const lines = byParent.get(itemId) ?? [];
  const available = itemId ? assembleNow(itemId, itemMap, byParent) : 0;
  const amount = Number(qty) || 0;

  const assemble = useMutation({
    mutationFn: async () => {
      if (!selected || !Number.isInteger(amount) || amount <= 0) throw new Error("Informe uma quantidade inteira maior que zero.");
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sua sessão expirou. Entre novamente.");
      const { error } = await supabase.rpc("assemble", { p_item_id: selected.id, p_qty: amount, p_user: auth.user.id });
      if (error) throw error;
      return `${amount} unidade(s) de ${selected.name}`;
    },
    onSuccess: (message) => {
      setCompleted(message);
      setQty("1");
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      toast.success("Montagem concluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Montagem</h1>
        <p className="mt-1 text-sm text-muted-foreground">Os componentes saem do estoque e o item montado entra automaticamente.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
        <form className="panel space-y-5 p-6" onSubmit={(e) => { e.preventDefault(); assemble.mutate(); }}>
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <Wrench className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Nova montagem</h2>
          </div>
          <div className="space-y-2">
            <Label>O que será montado</Label>
            <Select value={itemId} onValueChange={(value) => { setItemId(value); setCompleted(null); }}>
              <SelectTrigger><SelectValue placeholder="Selecione uma submontagem ou produto" /></SelectTrigger>
              <SelectContent>
                {candidates.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} — {item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assembly-qty">Quantidade a montar</Label>
            <Input id="assembly-qty" type="number" min={1} step={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          {selected && (
            <div className="rounded-md border border-border bg-muted p-4">
              <p className="text-xs uppercase text-muted-foreground">Máximo com componentes prontos</p>
              <p className="mt-1 font-display text-3xl font-bold">{available}</p>
            </div>
          )}
          {selected && amount > available && (
            <p className="flex gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />A quantidade supera o estoque direto dos componentes.</p>
          )}
          <Button type="submit" className="w-full" disabled={!selected || amount <= 0 || amount > available || assemble.isPending}>
            <Factory className="size-4" />{assemble.isPending ? "Montando..." : "Confirmar montagem"}
          </Button>
          {completed && <p className="flex gap-2 text-sm text-success"><CheckCircle2 className="size-4 shrink-0" />{completed} concluída(s).</p>}
        </form>

        <section className="panel overflow-hidden">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold">Consumo desta montagem</h2>
            <p className="text-sm text-muted-foreground">Confira o que será descontado antes de confirmar.</p>
          </header>
          {!selected ? (
            <p className="px-5 py-10 text-sm text-muted-foreground">Selecione um item para ver sua estrutura.</p>
          ) : (
            lines.map((line) => {
              const child = itemMap.get(line.child_id);
              if (!child) return null;
              const required = line.quantity * amount;
              const enough = child.quantity >= required;
              return (
                <div key={line.id} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0">
                  <div className="min-w-0 flex-1">
                    <Link to="/itens/$id" params={{ id: child.id }} className="truncate text-sm font-medium hover:underline">{child.name}</Link>
                    <p className="text-code">{child.code}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p><b>{required}</b> necessários</p>
                    <p className="text-muted-foreground">{child.quantity} em estoque</p>
                  </div>
                  <Badge variant={enough ? "outline" : "destructive"}>{enough ? "Disponível" : "Falta"}</Badge>
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}