"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/admin/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === "verified");
    if (!factor) {
      setPending(false);
      router.replace("/admin");
      return;
    }
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\D/g, "") });
    setPending(false);
    if (err) return setError("Código inválido ou expirado. Tente novamente.");
    router.replace("/admin");
    router.refresh();
  }

  return (
    <AuthShell title="Verificação em duas etapas" subtitle="Digite o código de 6 dígitos do seu aplicativo autenticador">
      <form onSubmit={verify} className="space-y-4">
        <Field label="Código" htmlFor="code">
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center text-xl tracking-[0.4em]"
          />
        </Field>
        {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending || code.replace(/\D/g, "").length !== 6}>
          {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verificar
        </Button>
      </form>
    </AuthShell>
  );
}
