"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBrowserSupabase } from "@/lib/supabase/browser";

interface Enrolling {
  factorId: string;
  qr: string;
  secret: string;
}

/** Ativa/desativa a verificação em duas etapas (TOTP) da usuária logada. */
export function MfaManager() {
  const [factorId, setFactorId] = useState<string | null | undefined>(undefined);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data } = await createBrowserSupabase().auth.mfa.listFactors();
    setFactorId(data?.totp?.find((f) => f.status === "verified")?.id ?? null);
  }
  useEffect(() => {
    createBrowserSupabase()
      .auth.mfa.listFactors()
      .then(({ data }) => setFactorId(data?.totp?.find((f) => f.status === "verified")?.id ?? null));
  }, []);

  async function start() {
    setBusy(true);
    const supabase = createBrowserSupabase();
    // remove tentativas anteriores não concluídas
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Studio Manager ${Date.now()}` });
    setBusy(false);
    if (error || !data) return toast.error("Não foi possível iniciar a configuração.");
    setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm() {
    if (!enrolling) return;
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code: code.replace(/\D/g, "") });
    setBusy(false);
    if (error) return toast.error("Código inválido. Confira o horário do celular e tente novamente.");
    toast.success("Verificação em duas etapas ativada.");
    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function disable() {
    if (!factorId || !window.confirm("Desativar a verificação em duas etapas?")) return;
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return toast.error("Para desativar, entre novamente informando o código do autenticador.");
    toast.success("Verificação em duas etapas desativada.");
    refresh();
  }

  if (factorId === undefined) return <Loader2 className="size-4 animate-spin text-gold" />;

  return (
    <div className="rounded-2xl bg-ivory p-4">
      <p className="text-[15px] font-medium text-ink">Verificação em duas etapas</p>
      {factorId ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
            <ShieldCheck className="size-4" /> Ativada — o login pede o código do autenticador.
          </span>
          <Button size="sm" variant="ghost" onClick={disable} disabled={busy}>
            <ShieldOff /> Desativar
          </Button>
        </div>
      ) : enrolling ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-[auto_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="QR code para o aplicativo autenticador" className="size-40 rounded-xl bg-white p-2" />
          <div className="space-y-3 text-sm">
            <p>1. Abra o Google Authenticator, Microsoft Authenticator ou similar e leia o QR code.</p>
            <p className="text-[12.5px] text-muted">
              Ou digite a chave: <code className="break-all">{enrolling.secret}</code>
            </p>
            <p>2. Digite o código de 6 dígitos:</p>
            <div className="flex gap-2">
              <Input inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="max-w-36 text-center tracking-widest" aria-label="Código" />
              <Button className="h-11" onClick={confirm} disabled={busy || code.replace(/\D/g, "").length !== 6}>
                {busy ? <Loader2 className="animate-spin" /> : null} Ativar
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">Desativada. Recomendada para proteger o acesso ao painel.</span>
          <Button size="sm" variant="outline" onClick={start} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Ativar
          </Button>
        </div>
      )}
    </div>
  );
}
