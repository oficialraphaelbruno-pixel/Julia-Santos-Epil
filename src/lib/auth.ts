import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Business, MemberRole } from "@/lib/types";
import { isAllowed, type Area, type Permissions } from "@/lib/permissions";

export interface AdminContext {
  userId: string;
  email: string;
  role: MemberRole;
  business: Business;
  supabase: Awaited<ReturnType<typeof createClient>>;
  /** Administrador geral: acesso total e gestão de usuários e permissões. */
  isPlatformAdmin: boolean;
  permissions: Permissions;
  canEdit: (area: Area) => boolean;
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
    .select("role, permissions, business:businesses(*)")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.business) return null;
  const { data: profile } = await supabase.from("profiles").select("is_platform_admin").eq("id", userData.user.id).maybeSingle();
  const isPlatformAdmin = Boolean(profile?.is_platform_admin);
  const role = membership.role as MemberRole;
  const permissions = (membership.permissions ?? {}) as Permissions;
  return {
    userId: userData.user.id,
    email: userData.user.email ?? "",
    role,
    business: membership.business as unknown as Business,
    supabase,
    isPlatformAdmin,
    permissions,
    canEdit: (area: Area) => isPlatformAdmin || (role === "owner" && isAllowed(permissions, area)),
  };
});

/** true quando a usuária tem verificação em duas etapas e ainda não informou o código nesta sessão. */
async function mfaPending(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return Boolean(data && data.nextLevel === "aal2" && data.currentLevel !== "aal2");
}

/** Para páginas: redireciona ao login quando não autorizada. */
export async function requireAdmin(opts: { owner?: boolean; platformAdmin?: boolean } = {}): Promise<AdminContext> {
  const supabase = await createClient();
  if (await mfaPending(supabase)) redirect("/admin/verificacao");
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login?erro=acesso");
  if (opts.owner && ctx.role !== "owner" && !ctx.isPlatformAdmin) redirect("/admin?erro=permissao");
  if (opts.platformAdmin && !ctx.isPlatformAdmin) redirect("/admin?erro=permissao");
  return ctx;
}

/** Para Server Actions: lança erro em vez de redirecionar. */
export async function assertAdmin(opts: { owner?: boolean; area?: Area; platformAdmin?: boolean } = {}): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) throw new Error("Sessão expirada. Entre novamente.");
  if (opts.platformAdmin && !ctx.isPlatformAdmin) throw new Error("Apenas o administrador geral pode fazer isso.");
  if (opts.owner && ctx.role !== "owner" && !ctx.isPlatformAdmin) throw new Error("Apenas a proprietária pode alterar esta configuração.");
  if (opts.area && !ctx.canEdit(opts.area)) throw new Error(AREA_LOCKED_MESSAGE);
  return ctx;
}

export const AREA_LOCKED_MESSAGE = "Esta área foi bloqueada pelo administrador do painel.";
