"use client";
import { useActionState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { updatePasswordAction } from "@/app/admin/auth-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nova senha" htmlFor="pw-new" hint="Mínimo de 10 caracteres, com letras e números.">
        <Input id="pw-new" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="pw-confirm">
        <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Alterar senha
        </Button>
        {state ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-rose-600"}>{state.ok ? state.message : state.error}</p> : null}
      </div>
    </form>
  );
}
