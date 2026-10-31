import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Business, MemberRole } from "@/lib/types";

export interface AdminContext {
  userId: string;
  email: string;
  role: MemberRole;
  business: Business;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Verifica no SERVIDOR que a usuária está autenticada e é membro de uma empresa.
 * Retorna null quando não autorizada.
 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const supabase = await createClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData.user) return null;
  if (await mfaPending(supabase)) return null;

  const { data: membership } = await supabase
    .from("business_members")
    .select("role, business:businesses(*)")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.business) return null;
  return {
    userId: userData.user.id,
    email: userData.user.email ?? "",
    role: membership.role as MemberRole,
    business: membership.business as unknown as Business,
    supabase,
  };
});

/** true quando a usuária tem verificação em duas etapas e ainda não informou o código nesta sessão. */
async function mfaPending(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return Boolean(data && data.nextLevel === "aal2" && data.currentLevel !== "aal2");
}

/** Para páginas: redireciona ao login quando não autorizada. */
export async function requireAdmin(opts: { owner?: boolean } = {}): Promise<AdminContext> {
  const supabase = await createClient();
  if (await mfaPending(supabase)) redirect("/admin/verificacao");
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login?erro=acesso");
  if (opts.owner && ctx.role !== "owner") redirect("/admin?erro=permissao");
  return ctx;
}

/** Para Server Actions: lança erro em vez de redirecionar. */
export async function assertAdmin(opts: { owner?: boolean } = {}): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Sessão expirada. Entre novamente.");
  if (opts.owner && ctx.role !== "owner") throw new Error("Apenas a proprietária pode alterar esta configuração.");
  return ctx;
}
