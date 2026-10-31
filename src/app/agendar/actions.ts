"use server";

import { z } from "zod";
import { after } from "next/server";
import { afterAppointmentChange } from "@/lib/appointment-events";
import { checkSlotAgainstGoogle, filterSlotsByGoogle } from "@/lib/availability";
import { createServiceClient } from "@/lib/supabase/admin";
import { getPublicBusiness } from "@/lib/public-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { newManageToken } from "@/lib/tokens";
import { friendlyDbError } from "@/lib/constants";
import { clientBookingSchema, dateKeySchema, slugSchema } from "@/lib/schemas";
import type { ActionResult } from "@/lib/action";
import { zodFieldErrors } from "@/lib/action";

export interface Slot {
  start: string;
  end: string;
}

const uuid = z.uuid();

export async function getAvailableDaysAction(slug: string, serviceId: string, from: string, to: string): Promise<string[]> {
  if (!slugSchema.safeParse(slug).success || !uuid.safeParse(serviceId).success) return [];
  if (!dateKeySchema.safeParse(from).success || !dateKeySchema.safeParse(to).success) return [];
  if (!(await checkRateLimit("dias", 90, 60))) return [];
  const business = await getPublicBusiness(slug);
  if (!business) return [];
  const db = createServiceClient();
  const { data, error } = await db.rpc("get_available_days", {
    p_business_id: business.id,
    p_service_id: serviceId,
    p_from: from,
    p_to: to,
  });
  if (error) return [];
  return (data as string[]) ?? [];
}

export async function getAvailableSlotsAction(slug: string, serviceId: string, day: string): Promise<Slot[]> {
  if (!slugSchema.safeParse(slug).success || !uuid.safeParse(serviceId).success || !dateKeySchema.safeParse(day).success) return [];
  if (!(await checkRateLimit("horarios", 120, 60))) return [];
  const business = await getPublicBusiness(slug);
  if (!business) return [];
  const db = createServiceClient();
  const { data, error } = await db.rpc("get_available_slots", {
    p_business_id: business.id,
    p_service_id: serviceId,
    p_day: day,
    p_exclude_appointment_id: null,
    p_online: true,
  });
  if (error) return [];
  const slots = ((data as { slot_start: string; slot_end: string }[]) ?? []).map((s) => ({
    start: new Date(s.slot_start).toISOString(),
    end: new Date(s.slot_end).toISOString(),
  }));
  return (await filterSlotsByGoogle(business.id, serviceId, slots)).slots;
}

export interface BookingCreated {
  reference: string;
  token: string;
  status: "pending" | "confirmed";
}

export async function createBookingAction(input: {
  slug: string;
  serviceId: string;
  startsAt: string;
  client: unknown;
}): Promise<ActionResult<BookingCreated>> {
  const base = z
    .object({ slug: slugSchema, serviceId: uuid, startsAt: z.iso.datetime({ offset: true }) })
    .safeParse(input);
  if (!base.success) return { ok: false, error: "Dados do agendamento inválidos." };

  const parsed = clientBookingSchema.safeParse(input.client);
  if (!parsed.success) {
    return { ok: false, error: "Confira os dados informados.", fieldErrors: zodFieldErrors(parsed.error.issues) };
  }
  if (parsed.data.website) return { ok: false, error: "Não foi possível concluir o agendamento." };

  if (!(await checkRateLimit("reserva", 6, 600))) {
    return { ok: false, error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos ou fale conosco pelo WhatsApp." };
  }

  const business = await getPublicBusiness(base.data.slug);
  if (!business) return { ok: false, error: "Empresa não encontrada." };

  // Agenda externa (Google): recusa conflito; se a consulta falhar, o pedido fica pendente.
  const external = await checkSlotAgainstGoogle(business.id, base.data.serviceId, base.data.startsAt);
  if (external.busy) {
    return { ok: false, error: friendlyDbError("HORARIO_INDISPONIVEL"), fieldErrors: { _code: "HORARIO_INDISPONIVEL" } };
  }

  const { token, hash } = newManageToken();
  const db = createServiceClient();
  const { data, error } = await db.rpc("create_online_booking", {
    p_business_id: business.id,
    p_service_id: base.data.serviceId,
    p_starts_at: base.data.startsAt,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_email: parsed.data.email ?? "",
    p_marketing_consent: parsed.data.marketing ?? false,
    p_client_message: parsed.data.message ?? "",
    p_manage_token_hash: hash,
  });

  if (error) {
    const code = error.message.includes("HORARIO_INDISPONIVEL") ? "HORARIO_INDISPONIVEL" : undefined;
    return { ok: false, error: friendlyDbError(error.message), ...(code ? { fieldErrors: { _code: code } } : {}) };
  }
  const row = (data as { appointment_id: string; reference_code: string; status: "pending" | "confirmed" }[])[0];
  let status = row.status;
  if (!external.externalVerified && status === "confirmed") {
    await db
      .from("appointments")
      .update({ status: "pending", confirmed_at: null, notes: "Confirmação manual: não foi possível verificar o Google Agenda no momento da reserva." })
      .eq("id", row.appointment_id);
    status = "pending";
  }
  after(() => afterAppointmentChange(row.appointment_id, "booking", { manageToken: token }));
  return { ok: true, data: { reference: row.reference_code, token, status } };
}
