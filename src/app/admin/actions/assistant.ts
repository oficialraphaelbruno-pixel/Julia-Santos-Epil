"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { friendlyDbError } from "@/lib/constants";
import { zodFieldErrors, type ActionResult } from "@/lib/action";

function refresh() {
  revalidatePath("/admin/assistente");
  revalidatePath("/duvidas");
  revalidatePath("/");
}

const settingsSchema = z.object({
  enabled: z.boolean(),
  name: z.string().trim().min(1, "Informe o nome").max(30, "Até 30 caracteres"),
  welcomeMessage: z.string().trim().min(1, "Escreva a mensagem de boas-vindas").max(600, "Até 600 caracteres"),
  personality: z.string().trim().max(1500, "Até 1.500 caracteres").optional().default(""),
  extraInfo: z.string().trim().max(4000, "Até 4.000 caracteres").optional().default(""),
  avoidTopics: z.string().trim().max(1500, "Até 1.500 caracteres").optional().default(""),
  dailyLimit: z.coerce.number().int("Número inteiro").min(10, "Mínimo 10").max(5000, "Máximo 5.000"),
  model: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._:-]{3,60}$/, "Nome de modelo inválido")
    .optional(),
});
export type AssistantSettingsInput = z.input<typeof settingsSchema>;

export async function saveAssistantSettingsAction(input: AssistantSettingsInput): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true, area: "assistente" });
    const p = settingsSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(p.error.issues) };
    const v = p.data;
    const row: Record<string, unknown> = {
      enabled: v.enabled,
      name: v.name,
      welcome_message: v.welcomeMessage,
      personality: v.personality || null,
      extra_info: v.extraInfo || null,
      avoid_topics: v.avoidTopics || null,
      daily_limit: v.dailyLimit,
    };
    // O modelo da OpenAI é uma escolha técnica: só o administrador geral altera.
    if (v.model && ctx.isPlatformAdmin) row.model = v.model;
    const { data, error } = await ctx.supabase.from("assistant_settings").update(row).eq("business_id", ctx.business.id).select("business_id");
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data?.length) return { ok: false, error: "Configuração não encontrada." };
    refresh();
    return { ok: true, message: "Configurações da assistente salvas." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

const faqSchema = z.object({
  id: z.uuid().optional().nullable(),
  category: z.enum(["pre", "pos", "pagamento", "agendamento", "outros"]),
  question: z.string().trim().min(3, "Escreva a pergunta").max(200, "Até 200 caracteres"),
  answer: z.string().trim().min(1, "Escreva a resposta").max(3000, "Até 3.000 caracteres"),
  published: z.boolean(),
});
export type FaqInput = z.input<typeof faqSchema>;

export async function saveFaqItemAction(input: FaqInput): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true, area: "assistente" });
    const p = faqSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(p.error.issues) };
    const v = p.data;
    if (v.id) {
      const { error } = await ctx.supabase
        .from("faq_items")
        .update({ category: v.category, question: v.question, answer: v.answer, published: v.published })
        .eq("id", v.id)
        .eq("business_id", ctx.business.id);
      if (error) return { ok: false, error: friendlyDbError(error.message) };
    } else {
      const { data: last } = await ctx.supabase
        .from("faq_items")
        .select("sort_order")
        .eq("business_id", ctx.business.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await ctx.supabase.from("faq_items").insert({
        business_id: ctx.business.id,
        category: v.category,
        question: v.question,
        answer: v.answer,
        published: v.published,
        sort_order: (last?.sort_order ?? 0) + 10,
      });
      if (error) return { ok: false, error: friendlyDbError(error.message) };
    }
    refresh();
    return { ok: true, message: v.id ? "Pergunta atualizada." : "Pergunta adicionada." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function setFaqPublishedAction(id: string, published: boolean): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true, area: "assistente" });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Pergunta inválida." };
    const { error } = await ctx.supabase.from("faq_items").update({ published }).eq("id", id).eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, message: published ? "Pergunta publicada." : "Pergunta escondida do site." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function moveFaqItemAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true, area: "assistente" });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Pergunta inválida." };
    const { data: item } = await ctx.supabase.from("faq_items").select("id, category").eq("id", id).eq("business_id", ctx.business.id).maybeSingle();
    if (!item) return { ok: false, error: "Pergunta não encontrada." };
    const { data: list } = await ctx.supabase
      .from("faq_items")
      .select("id")
      .eq("business_id", ctx.business.id)
      .eq("category", item.category)
      .order("sort_order")
      .order("created_at");
    const ids = (list ?? []).map((r) => r.id as string);
    const i = ids.indexOf(id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
    [ids[i], ids[j]] = [ids[j], ids[i]];
    for (const [idx, rowId] of ids.entries()) {
      const { error } = await ctx.supabase.from("faq_items").update({ sort_order: (idx + 1) * 10 }).eq("id", rowId).eq("business_id", ctx.business.id);
      if (error) return { ok: false, error: friendlyDbError(error.message) };
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deleteFaqItemAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true, area: "assistente" });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Pergunta inválida." };
    const { error } = await ctx.supabase.from("faq_items").delete().eq("id", id).eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, message: "Pergunta excluída." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Some com uma pergunta da lista "não soube responder" (ex.: já respondida no FAQ). */
export async function dismissAssistantQuestionAction(id: number): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true, area: "assistente" });
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Pergunta inválida." };
    const { error } = await ctx.supabase.from("assistant_logs").delete().eq("id", id).eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    revalidatePath("/admin/assistente");
    return { ok: true, message: "Removida da lista." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s|US\$|\$/g, "").replace(",", "."))
  .pipe(z.string().regex(/^\d{1,6}(\.\d{1,4})?$/, "Valor inválido"))
  .transform(Number);

const creditSchema = z.object({
  creditUsd: z.union([money, z.literal("")]),
  creditSince: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"), z.literal("")]),
  lowBalanceUsd: money,
  priceInput: money.optional(),
  priceOutput: money.optional(),
});
export type AssistantCreditInput = z.input<typeof creditSchema>;

/** Crédito colocado na OpenAI (para calcular o saldo) e, só para o administrador geral, preços por milhão de tokens. */
export async function saveAssistantCreditAction(input: AssistantCreditInput): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true, area: "assistente" });
    const p = creditSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(p.error.issues) };
    const v = p.data;
    if ((v.creditUsd === "") !== (v.creditSince === "")) {
      return { ok: false, error: "Informe o valor e a data da recarga.", fieldErrors: { [v.creditUsd === "" ? "creditUsd" : "creditSince"]: "Obrigatório" } };
    }
    const row: Record<string, unknown> = {
      credit_usd: v.creditUsd === "" ? null : v.creditUsd,
      credit_since: v.creditSince || null,
      low_balance_usd: v.lowBalanceUsd,
    };
    if (ctx.isPlatformAdmin) {
      if (v.priceInput !== undefined) row.price_input_per_m = v.priceInput;
      if (v.priceOutput !== undefined) row.price_output_per_m = v.priceOutput;
    }
    const { error } = await ctx.supabase.from("assistant_settings").update(row).eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    revalidatePath("/admin/assistente");
    return { ok: true, message: "Crédito atualizado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}
