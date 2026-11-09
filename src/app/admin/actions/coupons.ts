"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { friendlyDbError } from "@/lib/constants";
import { parseMoneyToCents } from "@/lib/format";
import { zodFieldErrors, type ActionResult } from "@/lib/action";

const optionalDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional().default("");

const couponSchema = z
  .object({
    id: z.uuid().optional().nullable(),
    code: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
      .pipe(z.string().regex(/^[A-Z0-9_-]{3,30}$/, "Use 3 a 30 letras, números, - ou _ (sem espaços e acentos)")),
    description: z.string().trim().max(200).optional().default(""),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.string().trim().min(1, "Informe o desconto"),
    maxUses: z.union([z.coerce.number().int().min(1, "Mínimo 1"), z.literal("")]).optional().default(""),
    oncePerClient: z.boolean(),
    minPrice: z.string().trim().optional().default(""),
    validFrom: optionalDate,
    validUntil: optionalDate,
    serviceIds: z.array(z.uuid()).optional().default([]),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.validFrom && v.validUntil && v.validUntil < v.validFrom) ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Deve ser depois do início" });
  });
export type CouponInput = z.input<typeof couponSchema>;

export async function saveCouponAction(input: CouponInput): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const p = couponSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(p.error.issues) };
    const v = p.data;
    let value: number | null;
    if (v.discountType === "percent") {
      value = Number(v.discountValue.replace(",", "."));
      if (!Number.isInteger(value) || value < 1 || value > 100) return { ok: false, error: "Porcentagem entre 1 e 100.", fieldErrors: { discountValue: "Entre 1 e 100" } };
    } else {
      value = parseMoneyToCents(v.discountValue);
      if (!value) return { ok: false, error: "Valor de desconto inválido.", fieldErrors: { discountValue: "Valor inválido" } };
    }
    const row = {
      business_id: ctx.business.id,
      code: v.code,
      description: v.description || null,
      discount_type: v.discountType,
      discount_value: value,
      max_uses: v.maxUses === "" ? null : v.maxUses,
      once_per_client: v.oncePerClient,
      min_price_cents: v.minPrice ? (parseMoneyToCents(v.minPrice) ?? 0) : 0,
      valid_from: v.validFrom || null,
      valid_until: v.validUntil || null,
      service_ids: v.serviceIds.length ? v.serviceIds : null,
      active: v.active,
    };
    const { error } = v.id
      ? await ctx.supabase.from("coupons").update(row).eq("id", v.id).eq("business_id", ctx.business.id)
      : await ctx.supabase.from("coupons").insert(row);
    if (error) {
      if (error.message.includes("duplicate key")) return { ok: false, error: "Já existe um cupom com esse nome.", fieldErrors: { code: "Nome já usado" } };
      return { ok: false, error: friendlyDbError(error.message) };
    }
    revalidatePath("/admin/cupons");
    return { ok: true, message: v.id ? "Cupom atualizado." : "Cupom criado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function setCouponActiveAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Cupom inválido." };
    const { error } = await ctx.supabase.from("coupons").update({ active }).eq("id", id).eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    revalidatePath("/admin/cupons");
    return { ok: true, message: active ? "Cupom ativado." : "Cupom desativado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Cupom inválido." };
    const { count } = await ctx.supabase.from("appointments").select("id", { count: "exact", head: true }).eq("coupon_id", id);
    if (count) return { ok: false, error: "Este cupom já foi usado em agendamentos. Desative-o em vez de excluir (o histórico é mantido)." };
    const { error } = await ctx.supabase.from("coupons").delete().eq("id", id).eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    revalidatePath("/admin/cupons");
    return { ok: true, message: "Cupom excluído." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
