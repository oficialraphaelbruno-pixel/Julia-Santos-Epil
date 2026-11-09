"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { friendlyDbError } from "@/lib/constants";
import { parseMoneyToCents } from "@/lib/format";
import { zodFieldErrors, type ActionResult } from "@/lib/action";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const methodEnum = z.enum(["pix", "dinheiro", "cartao_credito", "cartao_debito", "outros"]);

function refresh() {
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin");
}

function addMonthsKey(key: string, months: number) {
  const [y, m, d] = key.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, last));
  return base.toISOString().slice(0, 10);
}

const expenseSchema = z.object({
  id: z.uuid().optional().nullable(),
  description: z.string().trim().min(2, "Descreva a despesa").max(160),
  category: z.string().trim().min(2, "Escolha a categoria").max(60),
  amount: z.string().refine((v) => (parseMoneyToCents(v) ?? 0) > 0, "Valor inválido"),
  dueDate: dateKey,
  paid: z.boolean(),
  paidAt: z.union([dateKey, z.literal("")]).optional().default(""),
  method: z.union([methodEnum, z.literal("")]).optional().default(""),
  supplier: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  receiptPath: z.string().max(300).optional().nullable(),
  repeatMonths: z.coerce.number().int().min(1).max(24).optional().default(1),
});
export type ExpenseInput = z.input<typeof expenseSchema>;

export async function saveExpenseAction(input: ExpenseInput): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const p = expenseSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(p.error.issues) };
    const v = p.data;
    if (v.receiptPath && !v.receiptPath.startsWith(`${ctx.business.id}/`)) return { ok: false, error: "Comprovante inválido." };
    const base = {
      business_id: ctx.business.id,
      description: v.description,
      category: v.category,
      amount_cents: parseMoneyToCents(v.amount)!,
      method: v.method || null,
      supplier: v.supplier || null,
      notes: v.notes || null,
      receipt_path: v.receiptPath || null,
    };
    if (v.id) {
      const { error } = await ctx.supabase
        .from("expenses")
        .update({ ...base, due_date: v.dueDate, paid_at: v.paid ? v.paidAt || v.dueDate : null })
        .eq("id", v.id)
        .eq("business_id", ctx.business.id);
      if (error) return { ok: false, error: friendlyDbError(error.message) };
    } else {
      const group = v.repeatMonths > 1 ? randomUUID() : null;
      const rows = Array.from({ length: v.repeatMonths }, (_, i) => ({
        ...base,
        due_date: addMonthsKey(v.dueDate, i),
        // só a primeira parcela pode ser registrada como já paga
        paid_at: i === 0 && v.paid ? v.paidAt || v.dueDate : null,
        receipt_path: i === 0 ? base.receipt_path : null,
        recurrence_group: group,
        created_by: ctx.userId,
      }));
      const { error } = await ctx.supabase.from("expenses").insert(rows);
      if (error) return { ok: false, error: friendlyDbError(error.message) };
    }
    refresh();
    return { ok: true, message: v.id ? "Despesa atualizada." : v.repeatMonths > 1 ? `${v.repeatMonths} despesas lançadas.` : "Despesa lançada." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function setExpensePaidAction(id: string, paid: boolean, paidAt?: string, method?: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Despesa inválida." };
    const date = paidAt && dateKey.safeParse(paidAt).success ? paidAt : new Date().toISOString().slice(0, 10);
    const m = method && methodEnum.safeParse(method).success ? method : undefined;
    const { error } = await ctx.supabase
      .from("expenses")
      .update({ paid_at: paid ? date : null, ...(m ? { method: m } : {}) })
      .eq("id", id)
      .eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, message: paid ? "Despesa marcada como paga." : "Pagamento desfeito." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deleteExpenseAction(id: string, wholeSeries = false): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Despesa inválida." };
    const { data: e } = await ctx.supabase.from("expenses").select("id, recurrence_group, due_date, receipt_path").eq("id", id).maybeSingle();
    if (!e) return { ok: false, error: "Despesa não encontrada." };
    let q = ctx.supabase.from("expenses").delete().eq("business_id", ctx.business.id);
    q = wholeSeries && e.recurrence_group ? q.eq("recurrence_group", e.recurrence_group).gte("due_date", e.due_date).is("paid_at", null) : q.eq("id", id);
    const { error } = await q;
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (e.receipt_path && !wholeSeries) await ctx.supabase.storage.from("receipts").remove([e.receipt_path]);
    refresh();
    return { ok: true, message: wholeSeries ? "Parcelas futuras excluídas." : "Despesa excluída." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

const RECEIPT_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" } as const;

/** Envia comprovante para o armazenamento PRIVADO da empresa. */
export async function uploadReceiptAction(formData: FormData): Promise<ActionResult<{ path: string }>> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, error: "Selecione um arquivo." };
    const ext = RECEIPT_TYPES[file.type as keyof typeof RECEIPT_TYPES];
    if (!ext) return { ok: false, error: "Use foto (JPG, PNG, WEBP) ou PDF." };
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "O arquivo deve ter no máximo 8 MB." };
    const path = `${ctx.business.id}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
    const { error } = await ctx.supabase.storage.from("receipts").upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { ok: false, error: "Falha ao enviar o comprovante." };
    return { ok: true, data: { path } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Link temporário (5 minutos) para ver um comprovante. */
export async function receiptUrlAction(path: string): Promise<ActionResult<{ url: string }>> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!path.startsWith(`${ctx.business.id}/`)) return { ok: false, error: "Comprovante inválido." };
    const { data, error } = await ctx.supabase.storage.from("receipts").createSignedUrl(path, 300);
    if (error || !data) return { ok: false, error: "Comprovante não encontrado." };
    return { ok: true, data: { url: data.signedUrl } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

const incomeSchema = z.object({
  description: z.string().trim().min(2, "Descreva a receita").max(160),
  amount: z.string().refine((v) => (parseMoneyToCents(v) ?? 0) > 0, "Valor inválido"),
  method: methodEnum,
  date: dateKey,
});

/** Receita avulsa (ex.: venda de produto, gift card). */
export async function saveIncomeAction(input: z.input<typeof incomeSchema>): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const p = incomeSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const v = p.data;
    const { error } = await ctx.supabase.from("payments").insert({
      business_id: ctx.business.id,
      kind: "pagamento",
      method: v.method,
      amount_cents: parseMoneyToCents(v.amount)!,
      description: v.description,
      notes: v.description,
      paid_at: new Date(`${v.date}T15:00:00Z`).toISOString(),
      created_by: ctx.userId,
    });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, message: "Receita lançada." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deleteIncomeAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Lançamento inválido." };
    const { error } = await ctx.supabase.from("payments").delete().eq("id", id).eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, message: "Lançamento excluído." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

