"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { friendlyDbError } from "@/lib/constants";
import { zodFieldErrors, type ActionResult } from "@/lib/action";

const programSchema = z
  .object({
    enabled: z.boolean(),
    rewardType: z.enum(["percent", "fixed"]),
    rewardValue: z.coerce.number().int().min(1, "Informe o desconto"),
    friendType: z.enum(["percent", "fixed"]),
    friendValue: z.coerce.number().int().min(0),
    validDays: z.union([z.coerce.number().int().min(1).max(730), z.literal(""), z.null()]).optional(),
  })
  .refine((v) => v.rewardType !== "percent" || v.rewardValue <= 100, { message: "Máximo de 100%", path: ["rewardValue"] })
  .refine((v) => v.friendType !== "percent" || v.friendValue <= 100, { message: "Máximo de 100%", path: ["friendValue"] });
export type ReferralProgramInput = z.input<typeof programSchema>;

/** Valores em reais chegam em centavos; percentuais como número inteiro. */
export async function saveReferralProgramAction(input: ReferralProgramInput): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true, area: "indicacoes" });
    const parsed = programSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(parsed.error.issues) };
    const v = parsed.data;
    const { error } = await ctx.supabase
      .from("referral_programs")
      .update({
        enabled: v.enabled,
        reward_type: v.rewardType,
        reward_value: v.rewardValue,
        friend_type: v.friendType,
        friend_value: v.friendValue,
        reward_valid_days: typeof v.validDays === "number" ? v.validDays : null,
      })
      .eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    revalidatePath("/admin/indicacoes");
    revalidatePath("/agendar", "layout");
    return { ok: true, message: v.enabled ? "Programa de indicação salvo e ativo." : "Programa salvo (desativado)." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Cancela ou reativa manualmente um desconto de indicação ainda não usado. */
export async function setReferralRewardStatusAction(rewardId: string, status: "available" | "cancelled"): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true, area: "indicacoes" });
    if (!z.uuid().safeParse(rewardId).success) return { ok: false, error: "Desconto inválido." };
    const { data, error } = await ctx.supabase
      .from("referral_rewards")
      .update({ status })
      .eq("id", rewardId)
      .eq("business_id", ctx.business.id)
      .neq("status", "used")
      .select("id");
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data?.length) return { ok: false, error: "Este desconto já foi usado em um agendamento." };
    revalidatePath("/admin/indicacoes");
    return { ok: true, message: status === "cancelled" ? "Desconto cancelado." : "Desconto reativado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
