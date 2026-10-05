import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { fetchItems } from "@/lib/inventory";
import { ItemBomSection } from "@/components/inventory/item-detail/ItemBomSection";
import { ItemPhotoSection } from "@/components/inventory/item-detail/ItemPhotoSection";
import { ItemStockSection } from "@/components/inventory/item-detail/ItemStockSection";
import { ItemSuppliersSection } from "@/components/inventory/item-detail/ItemSuppliersSection";

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

function Detalhe() {
  const { id } = Route.useParams();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["items"], queryFn: fetchItems });
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!items.some((item) => item.id === id)) return <p className="text-sm text-muted-foreground">Item não encontrado.</p>;

  return <div className="space-y-8">
    <Link to="/itens" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Voltar para itens</Link>
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]"><ItemPhotoSection itemId={id} /><ItemStockSection itemId={id} /></div>
    <ItemBomSection itemId={id} relatedSections={<ItemSuppliersSection itemId={id} />} />
  </div>;
}