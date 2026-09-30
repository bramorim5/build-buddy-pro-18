import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <div className="grid-paper flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link to="/" className="font-display text-lg font-bold tracking-tight">
          Technolife<span className="text-primary"> Estoque</span>
        </Link>

        <div className="panel mt-6 p-8">
          <h1 className="text-2xl font-bold">
            {mode === "entrar" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "entrar"
              ? "Use seu e-mail e senha de acesso."
              : "Cadastre-se para acessar o estoque."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "criar" && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "entrar" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : mode === "entrar" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "entrar" ? "criar" : "entrar")}
            className="mt-6 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {mode === "entrar" ? "Não tenho conta ainda" : "Já tenho conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
