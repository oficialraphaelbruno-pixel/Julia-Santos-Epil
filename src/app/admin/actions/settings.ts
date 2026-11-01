"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { friendlyDbError } from "@/lib/constants";
import { normalizeBrazilPhone } from "@/lib/phone";
import { SUPABASE_URL } from "@/lib/env";
import { normalizePixKey } from "@/lib/pix";
import { zodFieldErrors, type ActionResult } from "@/lib/action";

const text = (max: number) => z.string().trim().max(max).optional().default("").transform((v) => (v ? v : null));
const url = z
  .string()
  .trim()
  .max(500)
  .optional()
  .default("")
  .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), "Use um endereço começando com https://")
  .transform((v) => (v ? v : null));

function refreshPublic() {
  revalidatePath("/", "layout");
}

const bookingSchema = z.object({
  onlineEnabled: z.boolean(),
  introText: text(1000),
  autoConfirm: z.boolean(),
  minAdvanceHours: z.coerce.number().min(0).max(336),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  slotInterval: z.coerce.number().int().refine((v) => [5, 10, 15, 20, 30, 45, 60].includes(v)),
  allowCancel: z.boolean(),
  cancelMinHours: z.coerce.number().int().min(0).max(720),
  allowReschedule: z.boolean(),
  rescheduleMinHours: z.coerce.number().int().min(0).max(720),
  cancellationPolicy: text(2000),
  maxActive: z.coerce.number().int().min(1).max(20),
  depositEnabled: z.boolean(),
  depositPercent: z.coerce.number().int().min(1).max(100),
  depositDeadlineHours: z.coerce.number().int().min(1).max(168),
  pixKeyType: z.enum(["telefone", "cpf", "cnpj", "email", "aleatoria"]),
  pixKey: z.string().trim().max(120).optional().default(""),
  pixHolder: text(120),
  pixBank: text(80),
  pixCity: text(40),
  depositInstructions: text(1000),
});
export type BookingSettingsInput = z.input<typeof bookingSchema>;

export async function saveBookingSettingsAction(input: BookingSettingsInput): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const p = bookingSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(p.error.issues) };
    const v = p.data;
    const pixKey = v.pixKey ? normalizePixKey(v.pixKey, v.pixKeyType) : null;
    if (v.pixKey && !pixKey) return { ok: false, error: "Chave Pix inválida para o tipo escolhido.", fieldErrors: { pixKey: "Chave inválida" } };
    if (v.depositEnabled && (!pixKey || !v.pixHolder)) {
      return { ok: false, error: "Para cobrar sinal, informe a chave Pix e o nome da favorecida.", fieldErrors: { pixKey: "Obrigatório" } };
    }
    const { error } = await ctx.supabase
      .from("booking_settings")
      .update({
        deposit_enabled: v.depositEnabled,
        deposit_percent: v.depositPercent,
        deposit_deadline_hours: v.depositDeadlineHours,
        pix_key: pixKey,
        pix_key_type: pixKey ? v.pixKeyType : null,
        pix_holder_name: v.pixHolder,
        pix_bank: v.pixBank,
        pix_city: v.pixCity,
        deposit_instructions: v.depositInstructions,
        online_enabled: v.onlineEnabled,
        intro_text: v.introText,
        auto_confirm: v.autoConfirm,
        min_advance_minutes: Math.round(v.minAdvanceHours * 60),
        max_advance_days: v.maxAdvanceDays,
        slot_interval_minutes: v.slotInterval,
        allow_client_cancel: v.allowCancel,
        cancel_min_hours: v.cancelMinHours,
        allow_client_reschedule: v.allowReschedule,
        reschedule_min_hours: v.rescheduleMinHours,
        cancellation_policy: v.cancellationPolicy,
        max_active_bookings_per_client: v.maxActive,
      })
      .eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refreshPublic();
    revalidatePath("/admin/agendamento-online");
    return { ok: true, message: "Configurações salvas." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(120),
  whatsapp: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((v) => !v || normalizeBrazilPhone(v) !== null, "WhatsApp inválido")
    .transform((v) => (v ? normalizeBrazilPhone(v) : null)),
  instagram: url,
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .default("")
    .refine((v) => !v || z.email().safeParse(v).success, "E-mail inválido")
    .transform((v) => (v ? v : null)),
  addressLine: text(200),
  addressDistrict: text(100),
  addressCity: text(100),
  addressState: text(2),
  addressZip: text(10),
  mapsUrl: url,
  legalName: text(160),
  documentId: text(30),
  hoursNote: text(500),
  heroTitle: text(120),
  heroSubtitle: text(300),
  aboutTitle: text(120),
  aboutText: text(4000),
  philosophyText: text(600),
});
export type ProfileInput = z.input<typeof profileSchema>;

export async function saveBusinessProfileAction(input: ProfileInput): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const p = profileSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(p.error.issues) };
    const v = p.data;
    const { error } = await ctx.supabase
      .from("businesses")
      .update({
        name: v.name,
        whatsapp_phone: v.whatsapp,
        instagram_url: v.instagram,
        email: v.email,
        address_line: v.addressLine,
        address_district: v.addressDistrict,
        address_city: v.addressCity,
        address_state: v.addressState?.toUpperCase() ?? null,
        address_zip: v.addressZip,
        maps_url: v.mapsUrl,
        legal_name: v.legalName,
        document_id: v.documentId,
        business_hours_note: v.hoursNote,
        hero_title: v.heroTitle,
        hero_subtitle: v.heroSubtitle,
        about_title: v.aboutTitle,
        about_text: v.aboutText,
        philosophy_text: v.philosophyText,
      })
      .eq("id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refreshPublic();
    return { ok: true, message: "Dados salvos." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function saveBusinessImageAction(field: "logo_url" | "photo_url" | "cover_url", value: string | null): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!["logo_url", "photo_url", "cover_url"].includes(field)) return { ok: false, error: "Campo inválido." };
    // Aceita apenas imagens da própria pasta da empresa no Storage ou os arquivos oficiais do projeto.
    const storagePrefix = `${SUPABASE_URL}/storage/v1/object/public/business-assets/${ctx.business.id}/`;
    if (value !== null && !(value.startsWith(storagePrefix) || /^\/brand\/[a-z0-9-]+\.(png|webp|jpg)$/.test(value))) {
      return { ok: false, error: "Imagem inválida." };
    }
    const { error } = await ctx.supabase.from("businesses").update({ [field]: value }).eq("id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refreshPublic();
    return { ok: true, message: "Imagem atualizada." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function saveLegalTextsAction(input: { privacy: string; terms: string }): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const p = z.object({ privacy: text(20000), terms: text(20000) }).safeParse(input);
    if (!p.success) return { ok: false, error: "Texto muito longo." };
    const { error } = await ctx.supabase
      .from("businesses")
      .update({ privacy_policy: p.data.privacy, terms_of_use: p.data.terms })
      .eq("id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refreshPublic();
    return { ok: true, message: "Textos salvos." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
