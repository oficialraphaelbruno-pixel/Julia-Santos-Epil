"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { afterAppointmentChange } from "@/lib/appointment-events";
import { checkSlotAgainstGoogle, filterSlotsByGoogle } from "@/lib/availability";
import { createServiceClient } from "@/lib/supabase/admin";
import { getBookingByToken } from "@/lib/manage-booking";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashToken, isValidTokenFormat } from "@/lib/tokens";
import { friendlyDbError } from "@/lib/constants";
import { dateKeySchema } from "@/lib/schemas";
import type { ActionResult } from "@/lib/action";
import type { Slot } from "@/app/agendar/actions";

export async function rescheduleDaysAction(token: string, from: string, to: string): Promise<string[]> {
  if (!dateKeySchema.safeParse(from).success || !dateKeySchema.safeParse(to).success) return [];
  if (!(await checkRateLimit("dias", 90, 60))) return [];
  const booking = await getBookingByToken(token);
  if (!booking?.canReschedule || !booking.service_id) return [];
  const { data } = await createServiceClient().rpc("get_available_days", {
    p_business_id: booking.business.id,
    p_service_id: booking.service_id,
    p_from: from,
    p_to: to,
    p_exclude_appointment_id: booking.id,
  });
  return (data as string[]) ?? [];
}

export async function rescheduleSlotsAction(token: string, day: string): Promise<Slot[]> {
  if (!dateKeySchema.safeParse(day).success) return [];
  if (!(await checkRateLimit("horarios", 120, 60))) return [];
  const booking = await getBookingByToken(token);
  if (!booking?.canReschedule || !booking.service_id) return [];
  const { data } = await createServiceClient().rpc("get_available_slots", {
    p_business_id: booking.business.id,
    p_service_id: booking.service_id,
    p_day: day,
    p_exclude_appointment_id: booking.id,
    p_online: true,
  });
  const slots = ((data as { slot_start: string; slot_end: string }[]) ?? []).map((s) => ({
    start: new Date(s.slot_start).toISOString(),
    end: new Date(s.slot_end).toISOString(),
  }));
  return (await filterSlotsByGoogle(booking.business.id, booking.service_id, slots)).slots;
}

export async function cancelByTokenAction(token: string, reason: string): Promise<ActionResult> {
  if (!isValidTokenFormat(token)) return { ok: false, error: "Link inválido." };
  if (!(await checkRateLimit("gerenciar", 20, 600))) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  const { error } = await createServiceClient().rpc("cancel_booking_by_token", {
    p_token_hash: hashToken(token),
    p_reason: z.string().max(300).catch("").parse(reason),
  });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  const id = await idByToken(token);
  if (id) after(() => afterAppointmentChange(id, "cancel"));
  revalidatePath(`/agendamento/${token}`);
  return { ok: true, message: "Agendamento cancelado." };
}

export async function rescheduleByTokenAction(token: string, newStart: string): Promise<ActionResult> {
  if (!isValidTokenFormat(token) || !z.iso.datetime({ offset: true }).safeParse(newStart).success) {
    return { ok: false, error: "Dados inválidos." };
  }
  if (!(await checkRateLimit("gerenciar", 20, 600))) return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
  const booking = await getBookingByToken(token);
  if (booking?.service_id) {
    const ext = await checkSlotAgainstGoogle(booking.business.id, booking.service_id, newStart);
    if (ext.busy) return { ok: false, error: friendlyDbError("HORARIO_INDISPONIVEL") };
  }
  const { error } = await createServiceClient().rpc("reschedule_booking_by_token", {
    p_token_hash: hashToken(token),
    p_new_start: newStart,
  });
  if (error) return { ok: false, error: friendlyDbError(error.message) };
  if (booking) after(() => afterAppointmentChange(booking.id, "reschedule"));
  revalidatePath(`/agendamento/${token}`);
  return { ok: true, message: "Agendamento reagendado." };
}

async function idByToken(token: string) {
  const { data } = await createServiceClient().from("appointments").select("id").eq("manage_token_hash", hashToken(token)).maybeSingle();
  return data?.id as string | undefined;
}
