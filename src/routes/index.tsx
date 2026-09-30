import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, Layers, Bell, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Technolife Estoque — controle de peças, submontagens e produtos" },
      {
        name: "description",
        content:
          "Estruturas de produto, estoque de componentes, alertas de compra e montagens que descontam automaticamente.",
      },
      { property: "og:title", content: "Technolife Estoque" },
      {
        property: "og:description",
        content:
          "Estruturas de produto, estoque de componentes, alertas de compra e montagens que descontam automaticamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Layers,
    title: "Estruturas completas",
    text: "Cada produto com foto, descrição e todos os componentes, passando pelas submontagens.",
  },
  {
    icon: Bell,
    title: "Aviso de compra",
    text: "Defina o limite de cada material e veja na hora o que precisa ser pedido.",
  },
  {
    icon: Factory,
    title: "Montagem que desconta",
    text: "Ao montar, as peças saem do estoque e a submontagem ou o produto entra.",
  },
  {
    icon: Boxes,
    title: "Quanto dá para produzir",
    text: "Registre a compra de componentes e veja quantos equipamentos são possíveis.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-lg font-bold tracking-tight">
            Technolife<span className="text-primary"> Estoque</span>
          </span>
          <Button asChild size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="grid-paper border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <p className="text-code uppercase">Controle de produção</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.05] sm:text-6xl">
              Todo o seu estoque, ligado da peça ao equipamento pronto.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Materiais, submontagens e produtos finais em uma única estrutura. Comprou, entrou.
              Montou, descontou.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Acessar o sistema</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="panel p-6">
                <f.icon className="size-5 text-primary" strokeWidth={2} />
                <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <p className="mx-auto max-w-6xl px-6 text-sm text-muted-foreground">
          Technolife — gestão de estoque e estruturas de produto.
        </p>
      </footer>
    </div>
  );
}
