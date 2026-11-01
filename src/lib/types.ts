import type { AppointmentStatus } from "@/lib/constants";

export interface Business {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  plan: string;
  billing_exempt: boolean;
  whatsapp_phone: string | null;
  instagram_url: string | null;
  email: string | null;
  address_line: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  maps_url: string | null;
  legal_name: string | null;
  document_id: string | null;
  business_hours_note: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  about_title: string | null;
  about_text: string | null;
  philosophy_text: string | null;
  logo_url: string | null;
  photo_url: string | null;
  cover_url: string | null;
  privacy_policy: string | null;
  terms_of_use: string | null;
}

export interface BookingSettings {
  business_id: string;
  online_enabled: boolean;
  intro_text: string | null;
  auto_confirm: boolean;
  min_advance_minutes: number;
  max_advance_days: number;
  slot_interval_minutes: number;
  allow_client_cancel: boolean;
  cancel_min_hours: number;
  allow_client_reschedule: boolean;
  reschedule_min_hours: number;
  cancellation_policy: string | null;
  max_active_bookings_per_client: number;
  deposit_enabled: boolean;
  deposit_percent: number;
  deposit_deadline_hours: number;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_holder_name: string | null;
  pix_bank: string | null;
  pix_city: string | null;
  deposit_instructions: string | null;
}

export interface Service {
  id: string;
  business_id: string;
  category_id: string | null;
  professional_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  prep_minutes: number;
  buffer_after_minutes: number;
  image_url: string | null;
  status: "active" | "inactive" | "archived";
  show_online: boolean;
  is_combo: boolean;
  sort_order: number;
  pre_care_text: string | null;
  post_care_text: string | null;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export interface Professional {
  id: string;
  display_name: string;
  active: boolean;
}

export interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  marketing_consent: boolean;
  privacy_accepted_at: string | null;
  source: "admin" | "online";
  created_at: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  professional_id: string;
  service_id: string | null;
  client_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: "admin" | "online";
  reference_code: string;
  service_name: string;
  price_cents: number;
  duration_minutes: number;
  notes: string | null;
  client_message: string | null;
  cancel_reason: string | null;
  cancelled_by: string | null;
  reschedule_count: number;
  created_at: string;
  deposit_cents: number;
  deposit_status: DepositStatus;
  deposit_due_at: string | null;
  deposit_paid_at: string | null;
}

export type DepositStatus = "nao_exigido" | "aguardando" | "pago" | "dispensado" | "devolvido";

export interface WorkingHour {
  id: string;
  professional_id: string;
  weekday: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
}

export type MemberRole = "owner" | "staff";
