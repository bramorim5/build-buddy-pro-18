import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoAsset from "@/assets/logo-technolife.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Technolife Estoque" },
      { name: "description", content: "Acesse o controle de estoque e produção da Technolife." },
      { property: "og:title", content: "Entrar — Technolife Estoque" },
      {
        property: "og:description",
        content: "Acesse o controle de estoque e produção da Technolife.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/painel", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/painel", replace: true });
        } else {
          toast.success("Conta criada", {
            description: "Confirme o e-mail que enviamos para poder entrar.",
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível continuar.";
      toast.error(
        message.includes("Invalid login credentials") ? "E-mail ou senha incorretos." : message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10 sm:py-14">
      <div className="w-full max-w-[28rem]">
        <header className="text-center">
          <img
            src={logoAsset.url}
            alt="Technolife Dental Excellence"
            className="mx-auto h-auto w-full max-w-[26rem] object-contain"
          />
          <h1 className="mt-9 text-3xl font-semibold text-foreground sm:text-4xl">
            Estoque Technolife
          </h1>
          <p className="mt-2.5 text-sm text-muted-foreground">
            {mode === "entrar" ? "Entre com seus dados de acesso." : "Crie sua conta de acesso."}
          </p>
        </header>

        <form onSubmit={submit} className="mt-10 space-y-6">
          {mode === "criar" && (
            <div className="space-y-2.5">
              <Label htmlFor="name" className="ml-1 text-xs font-semibold uppercase text-muted-foreground">
                Nome
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
                className="h-12 rounded-xl bg-card px-4 shadow-none focus-visible:ring-2 focus-visible:ring-ring/25"
              />
            </div>
          )}
          <div className="space-y-2.5">
            <Label htmlFor="email" className="ml-1 text-xs font-semibold uppercase text-muted-foreground">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="nome@exemplo.com"
              className="h-12 rounded-xl bg-card px-4 shadow-none focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="password" className="ml-1 text-xs font-semibold uppercase text-muted-foreground">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "entrar" ? "current-password" : "new-password"}
              placeholder="••••••••"
              className="h-12 rounded-xl bg-card px-4 shadow-none focus-visible:ring-2 focus-visible:ring-ring/25"
            />
          </div>
          <Button
            type="submit"
            className="h-12 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/15 active:scale-[0.99]"
            disabled={loading}
          >
            {loading ? "Aguarde..." : mode === "entrar" ? "Entrar" : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "entrar" ? "criar" : "entrar")}
          className="mx-auto mt-7 block text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline hover:underline-offset-4"
        >
          {mode === "entrar" ? "Não tenho conta ainda" : "Já tenho conta"}
        </button>
      </div>
    </main>
  );
}
