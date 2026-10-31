"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/env";
import type { ActionResult } from "@/lib/action";
import { passwordSchema } from "@/lib/schemas";

const loginSchema = z.object({
  email: z.email("E-mail inválido").max(160),
  password: z.string().min(1, "Informe a senha").max(200),
});

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: "Informe e-mail e senha válidos." };
  if (!(await checkRateLimit("login", 10, 900))) {
    return { ok: false, error: "Muitas tentativas de acesso. Aguarde 15 minutos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { ok: false, error: "E-mail ou senha incorretos." };

  // Autorização: precisa ser membro de alguma empresa.
  const { count } = await supabase.from("business_members").select("business_id", { count: "exact", head: true }).eq("user_id", data.user.id);
  if (!count) {
    await supabase.auth.signOut();
    return { ok: false, error: "Esta conta não tem acesso ao painel." };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/admin/verificacao");

  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/admin/") && !next.startsWith("//") ? next : "/admin");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function requestPasswordResetAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, error: "Informe um e-mail válido." };
  if (!(await checkRateLimit("recuperar", 5, 900))) {
    return { ok: false, error: "Muitas solicitações. Aguarde alguns minutos." };
  }
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${SITE_URL}/auth/confirm?next=/admin/nova-senha`,
  });
  // Resposta neutra: não revela se o e-mail existe.
  return { ok: true, message: "Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha." };
}

export async function updatePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return { ok: false, error: password.error.issues[0].message };
  if (formData.get("password") !== formData.get("confirm")) return { ok: false, error: "As senhas não coincidem." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { ok: false, error: "Não foi possível alterar a senha. Solicite um novo link." };
  return { ok: true, message: "Senha alterada com sucesso." };
}
