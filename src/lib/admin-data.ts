import "server-only";
import type { AdminContext } from "@/lib/auth";
import type { Professional } from "@/lib/types";

export async function getProfessionals(ctx: AdminContext) {
  const { data } = await ctx.supabase
    .from("professionals")
    .select("id, display_name, active")
    .eq("business_id", ctx.business.id)
    .order("created_at");
  return (data ?? []) as Professional[];
}
