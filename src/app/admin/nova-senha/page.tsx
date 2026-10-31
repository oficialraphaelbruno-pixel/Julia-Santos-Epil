"use client";
import Link from "next/link";
import { useActionState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { updatePasswordAction } from "@/app/admin/auth-actions";
import { AuthShell } from "@/components/admin/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export default function NewPasswordPage() {
  const [state, action, pending] = useActionState(updatePasswordAction, null);
  return (
    <AuthShell title="Criar nova senha" subtitle="Mínimo de 10 caracteres, com letras e números">
      {state?.ok ? (
        <div className="space-y-4 text-center">
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.message}</p>
          <Button asChild className="w-full">
            <Link href="/admin">Ir para o painel</Link>
          </Button>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <Field label="Nova senha" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          </Field>
          <Field label="Confirme a nova senha" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
          </Field>
          {state && !state.ok ? <p className="text-[13px] text-rose-600">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Salvar nova senha
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
