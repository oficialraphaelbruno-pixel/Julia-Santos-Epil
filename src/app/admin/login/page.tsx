import type { Metadata } from "next";
import { AuthShell } from "@/components/admin/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Acesso administrativo", robots: { index: false, follow: false } };

const ERRORS: Record<string, string> = {
  acesso: "Sua sessão expirou ou esta conta não tem acesso ao painel.",
  link: "O link é inválido ou expirou. Solicite um novo.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <AuthShell title="Bem-vinda de volta" subtitle="Acesse o painel do seu studio">
      <LoginForm next={next ?? ""} initialError={erro ? ERRORS[erro] : undefined} />
    </AuthShell>
  );
}
