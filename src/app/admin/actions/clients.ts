"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { syncAppointmentToGoogle } from "@/lib/appointment-events";
import { assertAdmin } from "@/lib/auth";
import { friendlyDbError } from "@/lib/constants";
import { optionalEmail, phoneSchema } from "@/lib/schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/action";

const clientSchema = z.object({
  id: z.uuid().optional().nullable(),
  fullName: z.string().trim().min(2, "Informe o nome").max(120),
  phone: phoneSchema,
  email: optionalEmail,
  birthday: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional().default(""),
  notes: z.string().trim().max(1000, "Máximo de 1000 caracteres").optional().default(""),
  marketingConsent: z.boolean().optional().default(false),
});
export type ClientInput = z.input<typeof clientSchema>;

export async function saveClientAction(input: ClientInput): Promise<ActionResult<{ id: string; full_name: string; phone: string }>> {
  try {
    const ctx = await assertAdmin();
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(parsed.error.issues) };
    const v = parsed.data;

    // Evita duplicidade: mesmo WhatsApp na mesma empresa.
    const { data: dup } = await ctx.supabase
      .from("clients")
      .select("id, full_name")
      .eq("business_id", ctx.business.id)
      .eq("phone", v.phone)
      .maybeSingle();
    if (dup && dup.id !== v.id) {
      return {
        ok: false,
        error: `Já existe uma cliente com este WhatsApp: ${dup.full_name}.`,
        fieldErrors: { phone: "WhatsApp já cadastrado", _existingId: dup.id },
      };
    }

    let previousConsent = false;
    if (v.id) {
      const { data: prev } = await ctx.supabase.from("clients").select("marketing_consent").eq("id", v.id).maybeSingle();
      previousConsent = Boolean(prev?.marketing_consent);
    }

    const row = {
      business_id: ctx.business.id,
      full_name: v.fullName,
      phone: v.phone,
      email: v.email || null,
      birthday: v.birthday || null,
      notes: v.notes || null,
      marketing_consent: v.marketingConsent,
      ...(v.marketingConsent && !previousConsent ? { marketing_consent_at: new Date().toISOString() } : {}),
      ...(!v.marketingConsent ? { marketing_consent_at: null } : {}),
    };
    const { data, error } = v.id
      ? await ctx.supabase.from("clients").update(row).eq("id", v.id).select("id, full_name, phone").single()
      : await ctx.supabase.from("clients").insert({ ...row, source: "admin" }).select("id, full_name, phone").single();
    if (error || !data) return { ok: false, error: friendlyDbError(error?.message) };

    revalidatePath("/admin/clientes");
    return { ok: true, data, message: v.id ? "Cliente atualizada." : "Cliente cadastrada." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function searchClientsAction(q: string) {
  const ctx = await assertAdmin();
  const term = q.trim().slice(0, 60);
  let query = ctx.supabase.from("clients").select("id, full_name, phone").eq("business_id", ctx.business.id).order("full_name").limit(12);
  if (term) {
    const digits = term.replace(/\D/g, "");
    const safe = term.replace(/[%,()*]/g, " ");
    query = digits.length >= 4 ? query.ilike("phone", `%${digits}%`) : query.ilike("full_name", `%${safe}%`);
  }
  const { data } = await query;
  return (data ?? []) as { id: string; full_name: string; phone: string }[];
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Cliente inválida." };
    const { count } = await ctx.supabase.from("appointments").select("id", { count: "exact", head: true }).eq("client_id", id);
    if (count) {
      return {
        ok: false,
        error: "Esta cliente possui histórico de atendimentos. Use \"Apagar dados da cliente\" para remover os dados pessoais mantendo o histórico.",
      };
    }
    const { error } = await ctx.supabase.from("clients").delete().eq("id", id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    revalidatePath("/admin/clientes");
    return { ok: true, message: "Cliente excluída." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** LGPD: remove dados pessoais mantendo o histórico financeiro/estatístico. */
export async function anonymizeClientAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Cliente inválida." };
    const { randomInt } = await import("node:crypto");
    const fakePhone = "00" + Array.from({ length: 13 }, () => randomInt(0, 10)).join("");
    const { error } = await ctx.supabase
      .from("clients")
      .update({
        full_name: "Cliente anonimizada",
        phone: fakePhone,
        email: null,
        birthday: null,
        notes: null,
        marketing_consent: false,
        marketing_consent_at: null,
      })
      .eq("id", id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    const { data: appts } = await ctx.supabase.from("appointments").select("id, starts_at").eq("client_id", id);
    await ctx.supabase.from("appointments").update({ client_message: null }).eq("client_id", id);
    const ids = (appts ?? []).map((a) => a.id);
    if (ids.length) {
      // destinatário (e-mail/telefone) guardado no histórico de envios
      await createServiceClient().from("message_logs").update({ recipient: null }).in("appointment_id", ids).eq("business_id", ctx.business.id);
      // eventos futuros no Google Agenda passam a mostrar o nome anonimizado
      const upcoming = (appts ?? []).filter((a) => new Date(a.starts_at).getTime() > Date.now()).map((a) => a.id);
      if (upcoming.length) after(() => Promise.allSettled(upcoming.map((aid) => syncAppointmentToGoogle(aid))));
    }
    revalidatePath("/admin/clientes");
    revalidatePath(`/admin/clientes/${id}`);
    return { ok: true, message: "Dados pessoais apagados. O histórico de atendimentos e valores foi mantido." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
