import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { CouponsManager, type CouponRow } from "@/components/admin/coupons-manager";
import { requireAdmin } from "@/lib/auth";
import { todayKey } from "@/lib/format";

export const metadata: Metadata = { title: "Cupons" };

export default async function CouponsPage() {
  const ctx = await requireAdmin();
  const [{ data: coupons }, { data: uses }, { data: services }] = await Promise.all([
    ctx.supabase.from("coupons").select("*").eq("business_id", ctx.business.id).order("created_at", { ascending: false }),
    ctx.supabase.from("appointments").select("coupon_id, discount_cents").eq("business_id", ctx.business.id).not("coupon_id", "is", null).neq("status", "cancelled"),
    ctx.supabase.from("services").select("id, name").eq("business_id", ctx.business.id).neq("status", "archived").order("sort_order").order("name"),
  ]);
  const stats = new Map<string, { uses: number; total: number }>();
  for (const u of uses ?? []) {
    const s = stats.get(u.coupon_id) ?? { uses: 0, total: 0 };
    s.uses += 1;
    s.total += u.discount_cents;
    stats.set(u.coupon_id, s);
  }
  const rows = (coupons ?? []).map((c) => ({ ...c, uses: stats.get(c.id)?.uses ?? 0, discount_total_cents: stats.get(c.id)?.total ?? 0 })) as CouponRow[];

  return (
    <>
      <PageHeader
        title="Cupons de desconto"
        description="Crie cupons com nome personalizado, limite de usos e validade. As clientes aplicam o cupom no agendamento online."
      />
      <CouponsManager coupons={rows} services={(services ?? []) as { id: string; name: string }[]} today={todayKey(ctx.business.timezone)} canEdit={ctx.role === "owner"} />
    </>
  );
}
