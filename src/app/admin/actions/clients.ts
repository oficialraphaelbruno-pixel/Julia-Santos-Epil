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
  let query = ctx.supabase
    .from("clients")
    .select("id, full_name, phone, blocked_at")
    .eq("business_id", ctx.business.id)
    .not("phone", "like", "00%") // dados apagados (LGPD)
    .order("full_name")
    .limit(12);
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
    const { data: photo } = await ctx.supabase.from("clients").select("photo_path").eq("id", id).maybeSingle();
    const { error } = await ctx.supabase.from("clients").delete().eq("id", id);
    if (!error && photo?.photo_path) await ctx.supabase.storage.from("client-photos").remove([photo.photo_path]);
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
    const { data: photo } = await ctx.supabase.from("clients").select("photo_path").eq("id", id).eq("business_id", ctx.business.id).maybeSingle();
    if (photo?.photo_path) await ctx.supabase.storage.from("client-photos").remove([photo.photo_path]);
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
        photo_path: null,
        blocked_reason: null,
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

// ---------------------------------------------------------------------
// Foto da cliente (área privada) e bloqueio
// ---------------------------------------------------------------------
const PHOTO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

export async function uploadClientPhotoAction(formData: FormData): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin();
    const clientId = String(formData.get("clientId") ?? "");
    const file = formData.get("file");
    if (!z.uuid().safeParse(clientId).success) return { ok: false, error: "Cliente inválida." };
    if (!(file instanceof File)) return { ok: false, error: "Selecione uma foto." };
    const ext = PHOTO_TYPES[file.type as keyof typeof PHOTO_TYPES];
    if (!ext) return { ok: false, error: "Formato não suportado. Use JPG, PNG ou WEBP." };
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: "A foto deve ter no máximo 5 MB." };
    const { data: client } = await ctx.supabase.from("clients").select("id, photo_path, phone").eq("id", clientId).eq("business_id", ctx.business.id).maybeSingle();
    if (!client) return { ok: false, error: "Cliente não encontrada." };
    if (client.phone?.startsWith("00")) return { ok: false, error: "Os dados desta cliente foram apagados." };
    const { randomUUID } = await import("node:crypto");
    const path = `${ctx.business.id}/${clientId}-${randomUUID()}.${ext}`;
    const { error: upErr } = await ctx.supabase.storage.from("client-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return { ok: false, error: "Falha ao enviar a foto." };
    const { error } = await ctx.supabase.from("clients").update({ photo_path: path }).eq("id", clientId);
    if (error) {
      await ctx.supabase.storage.from("client-photos").remove([path]);
      return { ok: false, error: friendlyDbError(error.message) };
    }
    if (client.photo_path) await ctx.supabase.storage.from("client-photos").remove([client.photo_path]);
    revalidatePath(`/admin/clientes/${clientId}`);
    revalidatePath("/admin/clientes");
    return { ok: true, message: "Foto salva." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao enviar a foto." };
  }
}

export async function removeClientPhotoAction(clientId: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin();
    if (!z.uuid().safeParse(clientId).success) return { ok: false, error: "Cliente inválida." };
    const { data: client } = await ctx.supabase.from("clients").select("photo_path").eq("id", clientId).eq("business_id", ctx.business.id).maybeSingle();
    if (!client) return { ok: false, error: "Cliente não encontrada." };
    if (client.photo_path) await ctx.supabase.storage.from("client-photos").remove([client.photo_path]);
    await ctx.supabase.from("clients").update({ photo_path: null }).eq("id", clientId);
    revalidatePath(`/admin/clientes/${clientId}`);
    revalidatePath("/admin/clientes");
    return { ok: true, message: "Foto removida." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Bloqueio: a cliente não consegue agendar online (por WhatsApp ou e-mail). O motivo é interno. */
export async function setClientBlockedAction(clientId: string, blocked: boolean, reason = ""): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(clientId).success) return { ok: false, error: "Cliente inválida." };
    const r = reason.trim().slice(0, 500);
    const { error } = await ctx.supabase
      .from("clients")
      .update(blocked ? { blocked_at: new Date().toISOString(), blocked_reason: r || null } : { blocked_at: null, blocked_reason: null })
      .eq("id", clientId)
      .eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    revalidatePath(`/admin/clientes/${clientId}`);
    revalidatePath("/admin/clientes");
    return { ok: true, message: blocked ? "Cliente bloqueada. Ela não conseguirá agendar pelo site." : "Cliente desbloqueada." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
