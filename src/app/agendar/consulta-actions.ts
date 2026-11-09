"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/admin";
import { getPublicBookingData, getPublicBusiness } from "@/lib/public-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeBrazilPhone } from "@/lib/phone";
import { buildDepositInfo, type DepositInfo } from "@/lib/pix-server";
import { slugSchema } from "@/lib/schemas";
import type { ActionResult } from "@/lib/action";
import type { AppointmentStatus } from "@/lib/constants";

export interface FoundBooking {
  reference: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  priceCents: number;
  discountCents: number;
  couponCode: string | null;
  depositStatus: string;
  deposit: DepositInfo | null;
}

/** Normaliza nomes para comparação: sem acentos, minúsculo, espaços simples. */
function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NOT_FOUND = "Não encontramos agendamentos com esses dados. Confira o e-mail ou WhatsApp e o nome completo usados no agendamento.";

/**
 * Consulta pela cliente: e-mail OU WhatsApp + nome completo (como informado no agendamento).
 * Mostra apenas agendamentos futuros/recentes dessa cliente. Mensagem genérica quando não encontra.
 */
export async function lookupBookingsAction(slug: string, contact: string, fullName: string): Promise<ActionResult<FoundBooking[]>> {
  const v = z
    .object({ slug: slugSchema, contact: z.string().trim().min(5).max(160), fullName: z.string().trim().min(3).max(120) })
    .safeParse({ slug, contact, fullName });
  if (!v.success) return { ok: false, error: "Informe o e-mail ou WhatsApp e seu nome completo." };
  if (!(await checkRateLimit("consulta", 8, 900))) {
    return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos ou fale com o studio pelo WhatsApp." };
  }
  const business = await getPublicBusiness(v.data.slug);
  if (!business) return { ok: false, error: NOT_FOUND };

  const db = createServiceClient();
  const isEmail = v.data.contact.includes("@");
  let query = db.from("clients").select("id, full_name").eq("business_id", business.id).limit(5);
  if (isEmail) {
    const email = v.data.contact.toLowerCase();
    if (!z.email().safeParse(email).success) return { ok: false, error: "E-mail inválido." };
    query = query.ilike("email", email.replace(/[%_\\]/g, "\\$&"));
  } else {
    const phone = normalizeBrazilPhone(v.data.contact);
    if (!phone) return { ok: false, error: "WhatsApp inválido. Use DDD + número." };
    query = query.eq("phone", phone);
  }
  const { data: clients } = await query;
  const wanted = normalizeName(v.data.fullName);
  const client = (clients ?? []).find((c) => normalizeName(c.full_name) === wanted);
  if (!client) return { ok: false, error: NOT_FOUND };

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: appts } = await db
    .from("appointments")
    .select("reference_code, service_name, starts_at, ends_at, status, price_cents, discount_cents, coupon_code, deposit_status, deposit_cents, deposit_due_at")
    .eq("client_id", client.id)
    .gte("starts_at", since)
    .order("starts_at")
    .limit(10);
  if (!appts?.length) return { ok: false, error: "Não há agendamentos futuros com esses dados." };

  const { settings } = await getPublicBookingData(business.id);
  const result: FoundBooking[] = [];
  for (const a of appts) {
    const active = a.status === "pending" || a.status === "confirmed";
    result.push({
      reference: a.reference_code,
      serviceName: a.service_name,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      status: a.status as AppointmentStatus,
      priceCents: a.price_cents,
      discountCents: a.discount_cents ?? 0,
      couponCode: a.coupon_code,
      depositStatus: a.deposit_status,
      deposit:
        active && a.deposit_status === "aguardando" && settings
          ? await buildDepositInfo({
              amountCents: a.deposit_cents,
              status: a.deposit_status,
              dueAt: a.deposit_due_at,
              reference: a.reference_code,
              settings,
              fallbackCity: business.address_city,
            })
          : null,
    });
  }
  return { ok: true, data: result };
}
