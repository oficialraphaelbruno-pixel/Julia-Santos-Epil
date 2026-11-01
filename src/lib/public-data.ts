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

export const getPublicBookingData = cache(async (businessId: string) => {
  const db = createServiceClient();
  const [settings, services, categories, professional] = await Promise.all([
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
  ]);
  return {
    settings: settings.data as PublicSettings | null,
    services: (services.data ?? []) as PublicService[],
    categories: (categories.data ?? []) as Category[],
    professionalName: (professional.data?.display_name as string | undefined) ?? null,
  };
});

export function businessAddress(b: Pick<Business, "address_line" | "address_district" | "address_city" | "address_state" | "address_zip">) {
  const cityState = [b.address_city, b.address_state].filter(Boolean).join(" - ");
  const parts = [b.address_line, b.address_district, cityState, b.address_zip ? `CEP ${b.address_zip}` : null].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
