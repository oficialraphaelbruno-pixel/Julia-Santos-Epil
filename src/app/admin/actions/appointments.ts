"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { afterAppointmentChange, type AppointmentEvent } from "@/lib/appointment-events";
import { filterSlotsByGoogle } from "@/lib/availability";
import { assertAdmin } from "@/lib/auth";
import { friendlyDbError } from "@/lib/constants";
import { localToUtcIso, parseMoneyToCents } from "@/lib/format";
import { dateKeySchema, timeSchema } from "@/lib/schemas";
import { zodFieldErrors, type ActionResult } from "@/lib/action";

const statusEnum = z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"]);

const appointmentSchema = z.object({
  id: z.uuid().optional().nullable(),
  serviceId: z.uuid({ message: "Escolha o serviço" }),
  clientId: z.uuid({ message: "Escolha a cliente" }),
  professionalId: z.string().optional().nullable(),
  date: dateKeySchema,
  time: timeSchema,
  status: statusEnum,
  price: z.string().optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  allowOutsideHours: z.boolean().optional().default(false),
});
export type AppointmentInput = z.input<typeof appointmentSchema>;

function refresh(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/agenda");
  if (id) revalidatePath(`/admin/agenda/${id}`);
}

export async function saveAppointmentAction(input: AppointmentInput): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await assertAdmin();
    const parsed = appointmentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(parsed.error.issues) };
    const v = parsed.data;
    const priceCents = v.price ? parseMoneyToCents(v.price) : null;
    if (v.price && priceCents === null) return { ok: false, error: "Valor inválido.", fieldErrors: { price: "Valor inválido" } };

    let previous: { starts_at: string; status: string } | null = null;
    if (v.id) {
      const { data: prev } = await ctx.supabase.from("appointments").select("starts_at, status").eq("id", v.id).maybeSingle();
      previous = prev;
    }
    const { data, error } = await ctx.supabase.rpc("admin_save_appointment", {
      p_business_id: ctx.business.id,
      p_appointment_id: v.id ?? null,
      p_service_id: v.serviceId,
      p_client_id: v.clientId,
      p_professional_id: v.professionalId && z.uuid().safeParse(v.professionalId).success ? v.professionalId : null,
      p_starts_at: localToUtcIso(v.date, v.time, ctx.business.timezone),
      p_status: v.status,
      p_price_cents: priceCents,
      p_notes: v.notes,
      p_allow_outside_hours: v.allowOutsideHours,
    });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    const id = data as string;
    const newStart = localToUtcIso(v.date, v.time, ctx.business.timezone);
    let event: AppointmentEvent = "update";
    if (!previous) event = v.status === "confirmed" ? "confirm" : "update";
    else if (v.status === "cancelled" && previous.status !== "cancelled") event = "cancel";
    else if (Date.parse(previous.starts_at) !== Date.parse(newStart)) event = "reschedule";
    else if (v.status === "confirmed" && previous.status !== "confirmed") event = "confirm";
    after(() => afterAppointmentChange(id, event));
    refresh(id);
    return { ok: true, data: { id }, message: v.id ? "Agendamento atualizado." : "Agendamento criado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function setAppointmentStatusAction(id: string, status: z.infer<typeof statusEnum>, reason?: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin();
    if (!z.uuid().safeParse(id).success || !statusEnum.safeParse(status).success) return { ok: false, error: "Dados inválidos." };
    const { error } = await ctx.supabase.rpc("admin_set_appointment_status", {
      p_appointment_id: id,
      p_status: status,
      p_reason: (reason ?? "").slice(0, 300),
    });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    const event: AppointmentEvent = status === "confirmed" ? "confirm" : status === "cancelled" ? "cancel" : "update";
    after(() => afterAppointmentChange(id, event));
    refresh(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function adminSlotsAction(serviceId: string, date: string, excludeId?: string | null): Promise<string[]> {
  const ctx = await assertAdmin();
  if (!z.uuid().safeParse(serviceId).success || !dateKeySchema.safeParse(date).success) return [];
  const { data } = await ctx.supabase.rpc("get_available_slots", {
    p_business_id: ctx.business.id,
    p_service_id: serviceId,
    p_day: date,
    p_exclude_appointment_id: excludeId && z.uuid().safeParse(excludeId).success ? excludeId : null,
    p_online: false,
  });
  const slots = ((data as { slot_start: string; slot_end: string }[]) ?? []).map((s) => ({
    start: new Date(s.slot_start).toISOString(),
    end: new Date(s.slot_end).toISOString(),
  }));
  return (await filterSlotsByGoogle(ctx.business.id, serviceId, slots)).slots.map((s) => s.start);
}

const paymentSchema = z.object({
  appointmentId: z.uuid(),
  amount: z.string().refine((v) => (parseMoneyToCents(v) ?? 0) > 0, "Informe o valor recebido"),
  discount: z.string().optional().default(""),
  method: z.enum(["pix", "dinheiro", "cartao_credito", "cartao_debito", "outros"]),
  notes: z.string().trim().max(300).optional().default(""),
});

export async function registerPaymentAction(input: z.input<typeof paymentSchema>): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin();
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const { data: appt } = await ctx.supabase.from("appointments").select("id, client_id").eq("id", v.appointmentId).maybeSingle();
    if (!appt) return { ok: false, error: "Agendamento não encontrado." };
    const { error } = await ctx.supabase.from("payments").insert({
      business_id: ctx.business.id,
      appointment_id: appt.id,
      client_id: appt.client_id,
      kind: "pagamento",
      method: v.method,
      amount_cents: parseMoneyToCents(v.amount)!,
      discount_cents: parseMoneyToCents(v.discount || "0") ?? 0,
      notes: v.notes || null,
      created_by: ctx.userId,
    });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh(appt.id);
    return { ok: true, message: "Pagamento registrado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function deletePaymentAction(id: string, appointmentId: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Pagamento inválido." };
    const { error } = await ctx.supabase.from("payments").delete().eq("id", id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh(appointmentId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
