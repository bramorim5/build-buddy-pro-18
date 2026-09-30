import { supabase } from "@/integrations/supabase/client";

export type ItemType = "material" | "submontagem" | "produto";

export const TYPE_LABEL: Record<ItemType, string> = {
  material: "Material",
  submontagem: "Submontagem",
  produto: "Produto final",
};

export type Item = {
  id: string;
  code: string;
  name: string;
  item_type: ItemType;
  description: string | null;
  photo_url: string | null;
  product_line: string | null;
  quantity: number;
  min_quantity: number;
};

export type BomLine = {
  id: string;
  parent_id: string;
  child_id: string;
  quantity: number;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  contact: string | null;
  notes: string | null;
};

export type ItemSupplier = {
  id: string;
  item_id: string;
  supplier_id: string;
  unit_cost: number | null;
  lead_time: string | null;
  is_primary: boolean;
};

export async function fetchItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select("id, code, name, item_type, description, photo_url, product_line, quantity, min_quantity")
    .order("code");
  if (error) throw error;
  return (data ?? []) as Item[];
}

export async function fetchBom(): Promise<BomLine[]> {
  const { data, error } = await supabase.from("bom_lines").select("id, parent_id, child_id, quantity");
  if (error) throw error;
  return (data ?? []).map((b) => ({ ...b, quantity: Number(b.quantity) })) as BomLine[];
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, phone, contact, notes")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function fetchItemSuppliers(): Promise<ItemSupplier[]> {
  const { data, error } = await supabase
    .from("item_suppliers")
    .select("id, item_id, supplier_id, unit_cost, lead_time, is_primary");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    unit_cost: r.unit_cost === null ? null : Number(r.unit_cost),
  })) as ItemSupplier[];
}

/** Índice de estrutura: pai -> linhas filhas. */
export function bomIndex(bom: BomLine[]) {
  const byParent = new Map<string, BomLine[]>();
  const byChild = new Map<string, BomLine[]>();
  for (const line of bom) {
    if (!byParent.has(line.parent_id)) byParent.set(line.parent_id, []);
    byParent.get(line.parent_id)!.push(line);
    if (!byChild.has(line.child_id)) byChild.set(line.child_id, []);
    byChild.get(line.child_id)!.push(line);
  }
  return { byParent, byChild };
}

/**
 * Quantas unidades dá para produzir, considerando o que já existe em estoque
 * das submontagens e, quando faltar, fabricando-as a partir dos materiais.
 */
export function buildableCount(
  itemId: string,
  items: Map<string, Item>,
  byParent: Map<string, BomLine[]>,
  visiting: Set<string> = new Set(),
): number {
  const item = items.get(itemId);
  if (!item) return 0;
  const lines = byParent.get(itemId);
  if (!lines || lines.length === 0 || visiting.has(itemId)) return item.quantity;

  visiting.add(itemId);
  let min = Infinity;
  for (const line of lines) {
    const need = line.quantity || 1;
    const available = buildableCount(line.child_id, items, byParent, visiting);
    min = Math.min(min, Math.floor(available / need));
  }
  visiting.delete(itemId);
  if (!Number.isFinite(min)) min = 0;
  return item.quantity + Math.max(0, min);
}

/** Quantas unidades dá para montar agora, só com o estoque direto dos filhos. */
export function assembleNow(itemId: string, items: Map<string, Item>, byParent: Map<string, BomLine[]>): number {
  const lines = byParent.get(itemId);
  if (!lines || lines.length === 0) return 0;
  let min = Infinity;
  for (const line of lines) {
    const child = items.get(line.child_id);
    if (!child) return 0;
    min = Math.min(min, Math.floor(child.quantity / (line.quantity || 1)));
  }
  return Number.isFinite(min) ? Math.max(0, min) : 0;
}

export function stockStatus(item: Item): "critico" | "baixo" | "ok" {
  if (item.min_quantity <= 0) return "ok";
  if (item.quantity <= 0) return "critico";
  if (item.quantity <= item.min_quantity) return "baixo";
  return "ok";
}

export function brl(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
