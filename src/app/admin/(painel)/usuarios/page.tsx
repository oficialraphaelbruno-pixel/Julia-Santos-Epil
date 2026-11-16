import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { TeamManager, type TeamMember } from "@/components/admin/team-manager";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import type { Permissions } from "@/lib/permissions";

export const metadata: Metadata = { title: "Usuários e permissões" };

export default async function UsersPage() {
  const ctx = await requireAdmin({ platformAdmin: true });
  const db = createServiceClient();
  const { data: rows } = await db
    .from("business_members")
    .select("user_id, permissions, created_at")
    .eq("business_id", ctx.business.id)
    .order("created_at");
  const ids = (rows ?? []).map((r) => r.user_id as string);
  const { data: profiles } = await db.from("profiles").select("id, is_platform_admin").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const adminSet = new Set((profiles ?? []).filter((p) => p.is_platform_admin).map((p) => p.id as string));
  const members: TeamMember[] = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data } = await db.auth.admin.getUserById(r.user_id as string);
      return {
        userId: r.user_id as string,
        email: data.user?.email ?? "(sem e-mail)",
        isPlatformAdmin: adminSet.has(r.user_id as string),
        isMe: r.user_id === ctx.userId,
        permissions: (r.permissions ?? {}) as Permissions,
        lastSignIn: data.user?.last_sign_in_at ? formatDateTime(data.user.last_sign_in_at, ctx.business.timezone) : null,
      };
    }),
  );
  members.sort((a, b) => Number(b.isPlatformAdmin) - Number(a.isPlatformAdmin));

  return (
    <>
      <PageHeader
        title="Usuários e permissões"
        description="Só o administrador geral vê esta página. Crie logins, troque senhas e escolha o que cada pessoa pode editar no painel e no site."
      />
      <TeamManager members={members} />
    </>
  );
}
