import "server-only";
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/admin";
import type { FaqItem, FaqService, FaqSettings } from "@/lib/faq-content";

export interface AssistantSettings {
  enabled: boolean;
  name: string;
  welcome_message: string;
  personality: string | null;
  extra_info: string | null;
  avoid_topics: string | null;
  daily_limit: number;
  model: string;
}

/** A assistente só aparece no site quando ligada no painel E com a chave da OpenAI configurada na Vercel. */
export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Dados públicos do FAQ e da assistente (lidos no servidor com a chave secreta). */
export const getFaqData = cache(async (businessId: string) => {
  const db = createServiceClient();
  const [faq, services, settings, assistant] = await Promise.all([
    db
      .from("faq_items")
      .select("id, category, question, answer, sort_order, published")
      .eq("business_id", businessId)
      .eq("published", true)
      .order("sort_order")
      .order("created_at"),
    db
      .from("services")
      .select("name, price_cents, duration_minutes, description, pre_care_text, post_care_text")
      .eq("business_id", businessId)
      .eq("status", "active")
      .eq("show_online", true)
      .order("sort_order")
      .order("name"),
    db
      .from("booking_settings")
      .select(
        "online_enabled, deposit_enabled, deposit_percent, deposit_deadline_hours, pix_key, pix_key_type, pix_holder_name, pix_bank, deposit_instructions, cancellation_policy, allow_client_cancel, cancel_min_hours, allow_client_reschedule, reschedule_min_hours",
      )
      .eq("business_id", businessId)
      .maybeSingle(),
    db
      .from("assistant_settings")
      .select("enabled, name, welcome_message, personality, extra_info, avoid_topics, daily_limit, model")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);
  return {
    faq: (faq.data ?? []) as FaqItem[],
    services: (services.data ?? []) as FaqService[],
    settings: (settings.data as FaqSettings | null) ?? null,
    assistant: (assistant.data as AssistantSettings | null) ?? null,
  };
});

/** Configuração mínima que o site precisa para mostrar o balão da assistente. */
export async function getPublicAssistant(businessId: string) {
  const { assistant } = await getFaqData(businessId);
  if (!assistant?.enabled || !openaiConfigured()) return null;
  return { name: assistant.name, welcome: assistant.welcome_message };
}
