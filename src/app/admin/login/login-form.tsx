"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { loginAction } from "@/app/admin/auth-actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  const error = state && !state.ok ? state.error : initialError;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <LogIn />} Entrar
      </Button>
      <div className="text-center">
        <Link href="/admin/recuperar-senha" className="text-sm text-gold-dark underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
      </div>
    </form>
  );
}
