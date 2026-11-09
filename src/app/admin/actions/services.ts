"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/format";
import { friendlyDbError } from "@/lib/constants";
import { zodFieldErrors, type ActionResult } from "@/lib/action";

const serviceSchema = z.object({
  id: z.uuid().optional().nullable(),
  name: z.string().trim().min(2, "Informe o nome do serviço").max(120),
  categoryId: z.string().optional().nullable(),
  newCategory: z.string().trim().max(60).optional().default(""),
  description: z.string().trim().max(1000).optional().default(""),
  price: z.string().refine((v) => parseMoneyToCents(v) !== null, "Valor inválido"),
  duration: z.coerce.number().int().min(5, "Mínimo de 5 minutos").max(720),
  prep: z.coerce.number().int().min(0).max(240),
  buffer: z.coerce.number().int().min(0).max(240),
  professionalId: z.string().optional().nullable(),
  status: z.enum(["active", "inactive", "archived"]),
  showOnline: z.boolean(),
  isCombo: z.boolean(),
  comboItems: z.array(z.uuid()).optional().default([]),
  imageUrl: z.string().max(500).optional().nullable(),
  preCare: z.string().trim().max(3000).optional().default(""),
  postCare: z.string().trim().max(3000).optional().default(""),
});
export type ServiceInput = z.input<typeof serviceSchema>;

function refresh() {
  revalidatePath("/admin/servicos");
  revalidatePath("/", "layout");
}

export async function saveServiceAction(input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const parsed = serviceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(parsed.error.issues) };
    const v = parsed.data;
    const db = ctx.supabase;

    let categoryId = v.categoryId && z.uuid().safeParse(v.categoryId).success ? v.categoryId : null;
    if (v.newCategory) {
      const { data: cat, error } = await db
        .from("service_categories")
        .upsert({ business_id: ctx.business.id, name: v.newCategory }, { onConflict: "business_id,name" })
        .select("id")
        .single();
      if (error) return { ok: false, error: friendlyDbError(error.message) };
      categoryId = cat.id;
    }

    const row = {
      business_id: ctx.business.id,
      name: v.name,
      category_id: categoryId,
      description: v.description || null,
      price_cents: parseMoneyToCents(v.price)!,
      duration_minutes: v.duration,
      prep_minutes: v.prep,
      buffer_after_minutes: v.buffer,
      professional_id: v.professionalId && z.uuid().safeParse(v.professionalId).success ? v.professionalId : null,
      status: v.status,
      show_online: v.showOnline,
      is_combo: v.isCombo,
      image_url: v.imageUrl || null,
      pre_care_text: v.preCare || null,
      post_care_text: v.postCare || null,
    };

    const { data, error } = v.id
      ? await db.from("services").update(row).eq("id", v.id).eq("business_id", ctx.business.id).select("id").single()
      : await db.from("services").insert(row).select("id").single();
    if (error || !data) return { ok: false, error: friendlyDbError(error?.message) };

    // Itens do combo
    await db.from("service_combo_items").delete().eq("combo_id", data.id);
    if (v.isCombo && v.comboItems.length) {
      const items = v.comboItems.filter((s) => s !== data.id).map((s) => ({ business_id: ctx.business.id, combo_id: data.id, service_id: s }));
      if (items.length) {
        const { error: itemsError } = await db.from("service_combo_items").insert(items);
        if (itemsError) return { ok: false, error: friendlyDbError(itemsError.message) };
      }
    }

    refresh();
    return { ok: true, data: { id: data.id }, message: v.id ? "Serviço atualizado." : "Serviço cadastrado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function setServiceStatusAction(id: string, status: "active" | "inactive" | "archived"): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Serviço inválido." };
    const { error } = await ctx.supabase.from("services").update({ status }).eq("id", id).eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function renameCategoryAction(id: string, name: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const n = z.string().trim().min(2).max(60).safeParse(name);
    if (!n.success || !z.uuid().safeParse(id).success) return { ok: false, error: "Nome inválido." };
    const { error } = await ctx.supabase.from("service_categories").update({ name: n.data }).eq("id", id);
    if (error) return { ok: false, error: friendlyDbError(error.message, "Já existe uma categoria com esse nome.") };
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Categoria inválida." };
    const { error } = await ctx.supabase.from("service_categories").delete().eq("id", id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Move um serviço uma posição para cima/baixo dentro da mesma categoria (ordem exibida no site). */
export async function moveServiceAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Serviço inválido." };
    const { data: all } = await ctx.supabase
      .from("services")
      .select("id, category_id, sort_order, name")
      .eq("business_id", ctx.business.id)
      .neq("status", "archived")
      .order("sort_order")
      .order("name");
    const list = all ?? [];
    const me = list.find((s) => s.id === id);
    if (!me) return { ok: false, error: "Serviço não encontrado." };
    const group = list.filter((s) => (s.category_id ?? null) === (me.category_id ?? null));
    const i = group.findIndex((s) => s.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= group.length) return { ok: true };
    [group[i], group[j]] = [group[j], group[i]];
    const results = await Promise.all(
      group.map((s, idx) => ctx.supabase.from("services").update({ sort_order: (idx + 1) * 10 }).eq("id", s.id).eq("business_id", ctx.business.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return { ok: false, error: friendlyDbError(failed.error.message) };
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Move uma categoria uma posição para cima/baixo (ordem dos blocos no site). */
export async function moveCategoryAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Categoria inválida." };
    const { data } = await ctx.supabase.from("service_categories").select("id, sort_order, name").eq("business_id", ctx.business.id).order("sort_order").order("name");
    const list = data ?? [];
    const i = list.findIndex((c) => c.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0) return { ok: false, error: "Categoria não encontrada." };
    if (j < 0 || j >= list.length) return { ok: true };
    [list[i], list[j]] = [list[j], list[i]];
    const results = await Promise.all(list.map((c, idx) => ctx.supabase.from("service_categories").update({ sort_order: (idx + 1) * 10 }).eq("id", c.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) return { ok: false, error: friendlyDbError(failed.error.message) };
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
