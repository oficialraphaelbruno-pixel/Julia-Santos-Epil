import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { hashToken, isValidTokenFormat } from "@/lib/tokens";
import { getPublicBookingData, getPublicBusiness, type PublicBusiness, type PublicSettings } from "@/lib/public-data";
import type { AppointmentStatus } from "@/lib/constants";

export interface ManagedBooking {
  id: string;
  reference_code: string;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  service_id: string | null;
  service_name: string;
  price_cents: number;
  duration_minutes: number;
  clientFirstName: string;
  professionalName: string | null;
  business: PublicBusiness;
  settings: PublicSettings;
  canCancel: boolean;
  canReschedule: boolean;
}

/** Busca o agendamento pelo token (somente o hash é consultado no banco). */
export async function getBookingByToken(token: string): Promise<ManagedBooking | null> {
  if (!isValidTokenFormat(token)) return null;
  const db = createServiceClient();
  const { data } = await db
    .from("appointments")
    .select(
      "id, business_id, reference_code, status, starts_at, ends_at, service_id, service_name, price_cents, duration_minutes, client:clients(full_name), professional:professionals(display_name), business:businesses(slug)",
    )
    .eq("manage_token_hash", hashToken(token))
    .maybeSingle();
  if (!data) return null;

  const slug = (data.business as unknown as { slug: string }).slug;
  const business = await getPublicBusiness(slug);
  if (!business) return null;
  const { settings } = await getPublicBookingData(business.id);
  if (!settings) return null;

  const hoursUntil = (new Date(data.starts_at).getTime() - Date.now()) / 36e5;
  const active = data.status === "pending" || data.status === "confirmed";

  return {
    id: data.id,
    reference_code: data.reference_code,
    status: data.status as AppointmentStatus,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    service_id: data.service_id,
    service_name: data.service_name,
    price_cents: data.price_cents,
    duration_minutes: data.duration_minutes,
    clientFirstName: ((data.client as unknown as { full_name: string } | null)?.full_name ?? "").split(" ")[0],
    professionalName: (data.professional as unknown as { display_name: string } | null)?.display_name ?? null,
    business,
    settings,
    canCancel: active && settings.allow_client_cancel && hoursUntil >= settings.cancel_min_hours,
    canReschedule: active && !!data.service_id && settings.allow_client_reschedule && hoursUntil >= settings.reschedule_min_hours,
  };
}
