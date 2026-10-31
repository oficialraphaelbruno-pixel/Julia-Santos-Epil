"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2, Mail } from "lucide-react";
import { requestPasswordResetAction } from "@/app/admin/auth-actions";
import { AuthShell } from "@/components/admin/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export default function RecoverPage() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, null);
  return (
    <AuthShell title="Recuperar senha" subtitle="Enviaremos um link para o seu e-mail">
      {state?.ok ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.message}</p>
      ) : (
        <form action={action} className="space-y-4">
          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          {state && !state.ok ? <p className="text-[13px] text-rose-600">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Mail />} Enviar link
          </Button>
        </form>
      )}
      <div className="mt-5 text-center">
        <Link href="/admin/login" className="text-sm text-gold-dark underline-offset-4 hover:underline">
          Voltar ao login
        </Link>
      </div>
    </AuthShell>
  );
}
