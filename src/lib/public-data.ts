import "server-only";
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/admin";
import type { Business, BookingSettings, Category, Service } from "@/lib/types";

/** Campos da empresa que podem ser exibidos publicamente. */
const PUBLIC_BUSINESS_FIELDS =
  "id, slug, name, timezone, whatsapp_phone, instagram_url, email, address_line, address_district, address_city, address_state, address_zip, maps_url, legal_name, document_id, business_hours_note, hero_title, hero_subtitle, about_title, about_text, philosophy_text, logo_url, photo_url, cover_url, privacy_policy, terms_of_use";

export type PublicBusiness = Omit<Business, "plan" | "billing_exempt">;
export type PublicService = Pick<
  Service,
  "id" | "name" | "description" | "price_cents" | "duration_minutes" | "image_url" | "category_id" | "is_combo" | "sort_order"
>;
export type PublicSettings = Pick<
  BookingSettings,
  | "online_enabled"
  | "intro_text"
  | "auto_confirm"
  | "min_advance_minutes"
  | "max_advance_days"
  | "allow_client_cancel"
  | "cancel_min_hours"
  | "allow_client_reschedule"
  | "reschedule_min_hours"
  | "cancellation_policy"
  | "deposit_enabled"
  | "deposit_percent"
  | "deposit_deadline_hours"
  | "pix_key"
  | "pix_key_type"
  | "pix_holder_name"
  | "pix_bank"
  | "pix_city"
  | "deposit_instructions"
>;

export const getPublicBusiness = cache(async (slug: string) => {
  const db = createServiceClient();
  const { data, error } = await db.from("businesses").select(PUBLIC_BUSINESS_FIELDS).eq("slug", slug).maybeSingle();
  if (error) throw new Error("Falha ao carregar a empresa.");
  return data as PublicBusiness | null;
});

/** Oferta (order bump) exibida no agendamento: serviço extra com preço especial. */
export interface PublicOffer {
  id: string;
  serviceId: string;
  offerServiceId: string;
  name: string;
  description: string | null;
  headline: string | null;
  priceCents: number;
  originalPriceCents: number;
  durationMinutes: number;
}

export const getPublicBookingData = cache(async (businessId: string) => {
  const db = createServiceClient();
  const [settings, services, categories, professional, offers] = await Promise.all([
    db
      .from("booking_settings")
      .select(
        "online_enabled, intro_text, auto_confirm, min_advance_minutes, max_advance_days, allow_client_cancel, cancel_min_hours, allow_client_reschedule, reschedule_min_hours, cancellation_policy, deposit_enabled, deposit_percent, deposit_deadline_hours, pix_key, pix_key_type, pix_holder_name, pix_bank, pix_city, deposit_instructions",
      )
      .eq("business_id", businessId)
      .single(),
    db
      .from("services")
      .select("id, name, description, price_cents, duration_minutes, image_url, category_id, is_combo, sort_order")
      .eq("business_id", businessId)
      .eq("status", "active")
      .eq("show_online", true)
      .order("sort_order")
      .order("name"),
    db.from("service_categories").select("id, name, sort_order").eq("business_id", businessId).order("sort_order").order("name"),
    db
      .from("professionals")
      .select("id, display_name")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    db
      .from("service_offers")
      .select("id, service_id, offer_service_id, offer_price_cents, headline, sort_order, offer:services!service_offers_business_id_offer_service_id_fkey(name, description, price_cents, duration_minutes, status)")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("sort_order"),
  ]);
  type OfferRow = {
    id: string;
    service_id: string;
    offer_service_id: string;
    offer_price_cents: number;
    headline: string | null;
    offer: { name: string; description: string | null; price_cents: number; duration_minutes: number; status: string } | null;
  };
  const publicOffers: PublicOffer[] = ((offers.data ?? []) as unknown as OfferRow[])
    .filter((o) => o.offer && o.offer.status === "active")
    .map((o) => ({
      id: o.id,
      serviceId: o.service_id,
      offerServiceId: o.offer_service_id,
      name: o.offer!.name,
      description: o.offer!.description,
      headline: o.headline,
      priceCents: o.offer_price_cents,
      originalPriceCents: o.offer!.price_cents,
      durationMinutes: o.offer!.duration_minutes,
    }));
  return {
    settings: settings.data as PublicSettings | null,
    services: (services.data ?? []) as PublicService[],
    categories: (categories.data ?? []) as Category[],
    professionalName: (professional.data?.display_name as string | undefined) ?? null,
    offers: publicOffers,
  };
});

/** Valida ofertas escolhidas para um serviço e devolve os minutos extras (ou null se inválidas). */
export async function resolveOffers(businessId: string, serviceId: string, offerIds: string[]) {
  if (!offerIds.length) return { minutes: 0, ids: [] as string[] };
  const { offers } = await getPublicBookingData(businessId);
  const ids = [...new Set(offerIds)];
  const chosen = offers.filter((o) => o.serviceId === serviceId && ids.includes(o.id));
  if (chosen.length !== ids.length) return null;
  return { minutes: chosen.reduce((t, o) => t + o.durationMinutes, 0), ids };
}

export { businessAddress } from "@/lib/address";

export interface LinkCoupon {
  code: string;
  /** Ex.: "30% de desconto" */
  label: string;
  /** Serviços em que o cupom vale (null = todos). */
  serviceIds: string[] | null;
}

/**
 * Cupom recebido por link de divulgação. Só devolve dados de cupons ativos,
 * dentro da validade e com usos disponíveis; a validação definitiva (serviço,
 * valor mínimo, uso por cliente) continua no banco, no momento do agendamento.
 */
export async function getLinkCoupon(businessId: string, timezone: string, code: string): Promise<LinkCoupon | null> {
  const db = createServiceClient();
  const { data: c } = await db
    .from("coupons")
    .select("id, code, discount_type, discount_value, max_uses, valid_from, valid_until, service_ids, active")
    .eq("business_id", businessId)
    .eq("code", code)
    .maybeSingle();
  if (!c || !c.active) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  if ((c.valid_from && today < c.valid_from) || (c.valid_until && today > c.valid_until)) return null;
  if (c.max_uses !== null) {
    const { count } = await db
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("coupon_id", c.id)
      .neq("status", "cancelled");
    if ((count ?? 0) >= c.max_uses) return null;
  }
  const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return {
    code: c.code,
    label: c.discount_type === "percent" ? `${c.discount_value}% de desconto` : `${money(c.discount_value)} de desconto`,
    serviceIds: c.service_ids?.length ? (c.service_ids as string[]) : null,
  };
}

export interface ReferralInfo {
  code: string;
  referrerFirstName: string;
  /** Ex.: "5% de desconto" (null quando a amiga não ganha desconto) */
  friendLabel: string | null;
}

/** Código de indicação válido (programa ativo) → primeiro nome de quem indicou e desconto da amiga. */
export async function getReferralInfo(businessId: string, code: string): Promise<ReferralInfo | null> {
  const { data } = await createServiceClient().rpc("referral_code_info", { p_business_id: businessId, p_code: code });
  const row = (data as { referrer_first_name: string; friend_type: string; friend_value: number }[] | null)?.[0];
  if (!row) return null;
  const { discountText } = await import("@/lib/coupon-code");
  return { code, referrerFirstName: row.referrer_first_name, friendLabel: row.friend_value > 0 ? discountText(row.friend_type, row.friend_value) : null };
}

export interface ReferralProgram {
  enabled: boolean;
  reward_type: "percent" | "fixed";
  reward_value: number;
  friend_type: "percent" | "fixed";
  friend_value: number;
  reward_valid_days: number | null;
}

export async function getReferralProgram(businessId: string): Promise<ReferralProgram | null> {
  const { data } = await createServiceClient()
    .from("referral_programs")
    .select("enabled, reward_type, reward_value, friend_type, friend_value, reward_valid_days")
    .eq("business_id", businessId)
    .maybeSingle();
  return (data as ReferralProgram | null) ?? null;
}

/** Link pessoal de indicação da cliente (gera o código na primeira vez). null se o programa estiver desativado. */
export async function clientReferralLink(businessId: string, clientId: string, siteUrl: string): Promise<string | null> {
  const program = await getReferralProgram(businessId);
  if (!program?.enabled) return null;
  const { data } = await createServiceClient().rpc("client_referral_code", { p_client_id: clientId });
  return typeof data === "string" && data ? `${siteUrl}/indicacao/${data}` : null;
}
