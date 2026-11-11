import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { deleteEvent, getConnection, googleConfig, upsertEvent } from "@/lib/google-calendar";
import { emailConfig, renderEmailHtml, sendEmail } from "@/lib/email";
import { sendWhatsappTemplate, whatsappCloudConfig } from "@/lib/whatsapp-cloud";
import { renderTemplate, type TemplateKey, type Templates } from "@/lib/templates";
import { businessAddress } from "@/lib/public-data";
import { formatDate, formatDuration, formatMoney, formatTime } from "@/lib/format";
import { PIX_KEY_TYPE_LABEL, formatPixKey } from "@/lib/pix";
import { SITE_URL } from "@/lib/env";
import { formatPhone, isAnonymizedPhone } from "@/lib/phone";

export type AppointmentEvent = "booking" | "confirm" | "cancel" | "reschedule" | "update" | "complete" | "reminder_day_before" | "reminder_2h";

const GOOGLE_STATUSES = ["confirmed", "in_progress", "completed"];

interface Loaded {
  id: string;
  business_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  service_name: string;
  price_cents: number;
  duration_minutes: number;
  reference_code: string;
  notes: string | null;
  deposit_cents: number;
  deposit_status: string;
  service: { pre_care_text: string | null; post_care_text: string | null } | null;
  client: { full_name: string; phone: string; email: string | null } | null;
  business: {
    name: string;
    slug: string;
    timezone: string;
    logo_url: string | null;
    whatsapp_phone: string | null;
    email: string | null;
    address_line: string | null;
    address_district: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
  };
}

async function load(appointmentId: string) {
  const db = createServiceClient();
  const { data } = await db
    .from("appointments")
    .select(
      "id, business_id, status, starts_at, ends_at, service_name, price_cents, duration_minutes, reference_code, notes, deposit_cents, deposit_status, service:services(pre_care_text, post_care_text), client:clients(full_name, phone, email), business:businesses(name, slug, timezone, logo_url, whatsapp_phone, email, address_line, address_district, address_city, address_state, address_zip)",
    )
    .eq("id", appointmentId)
    .maybeSingle();
  return data as unknown as Loaded | null;
}

async function logSync(businessId: string, appointmentId: string, action: string, ok: boolean, message?: string) {
  const db = createServiceClient();
  await db.from("sync_logs").insert({ business_id: businessId, appointment_id: appointmentId, action, ok, message: message?.slice(0, 500) ?? null });
}

/** Mantém o evento do Google Agenda alinhado ao agendamento interno. */
export async function syncAppointmentToGoogle(appointmentId: string) {
  const a = await load(appointmentId);
  if (!a) return;
  const conn = await getConnection(a.business_id);
  if (!conn || !conn.calendar_id || !googleConfig().configured) return;
  const db = createServiceClient();
  const { data: link } = await db.from("appointment_external_events").select("*").eq("appointment_id", a.id).maybeSingle();

  try {
    if (GOOGLE_STATUSES.includes(a.status)) {
      const sameCalendar = link && link.calendar_id === conn.calendar_id;
      const ev = await upsertEvent(a.business_id, sameCalendar ? link.external_event_id : null, {
        appointmentId: a.id,
        summary: `${a.service_name} — ${a.client?.full_name ?? "Cliente"}`,
        description: [
          `Referência: ${a.reference_code}`,
          a.client ? `Cliente: ${a.client.full_name} · WhatsApp +${a.client.phone}` : null,
          `Valor: ${formatMoney(a.price_cents)}`,
          `Painel: ${SITE_URL}/admin/agenda/${a.id}`,
        ]
          .filter(Boolean)
          .join("\n"),
        location: businessAddress(a.business),
        start: a.starts_at,
        end: a.ends_at,
        timeZone: a.business.timezone,
      });
      if (link && !sameCalendar) await deleteEvent(a.business_id, link.calendar_id, link.external_event_id).catch(() => null);
      await db.from("appointment_external_events").upsert({
        appointment_id: a.id,
        business_id: a.business_id,
        provider: "google",
        calendar_id: ev.calendarId,
        external_event_id: ev.id,
        synced_at: new Date().toISOString(),
      });
      await logSync(a.business_id, a.id, link ? "atualizar_evento" : "criar_evento", true);
    } else if (link) {
      await deleteEvent(a.business_id, link.calendar_id, link.external_event_id);
      await db.from("appointment_external_events").delete().eq("appointment_id", a.id);
      await logSync(a.business_id, a.id, "remover_evento", true);
    }
    await db.from("google_calendar_connections").update({ last_sync_at: new Date().toISOString(), status: "connected", last_error: null }).eq("business_id", a.business_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha na sincronização";
    await logSync(a.business_id, a.id, "sincronizar", false, msg);
    await db.from("google_calendar_connections").update({ status: "error", last_error: msg.slice(0, 500) }).eq("business_id", a.business_id);
  }
}

function templateFor(event: AppointmentEvent, status: string, depositStatus: string): TemplateKey | null {
  switch (event) {
    case "booking":
      if (depositStatus === "aguardando") return "sinal";
      return status === "confirmed" ? "confirmacao" : "recebido";
    case "complete":
      return "orientacoes_pos";
    case "confirm":
      return "confirmacao";
    case "cancel":
      return "cancelamento";
    case "reschedule":
      return "reagendamento";
    case "reminder_day_before":
    case "reminder_2h":
      return "lembrete";
    default:
      return null;
  }
}

const SUBJECTS: Record<TemplateKey, string> = {
  recebido: "Recebemos seu agendamento",
  confirmacao: "Agendamento confirmado ✨",
  lembrete: "Lembrete do seu atendimento",
  cancelamento: "Agendamento cancelado",
  reagendamento: "Agendamento reagendado",
  sinal: "Seu horário está reservado — falta o sinal",
  orientacoes_pre: "Orientações para o seu atendimento",
  orientacoes_pos: "Cuidados após o seu atendimento 💛",
};

/** Envia as comunicações automáticas configuradas (e-mail e, se ativado, WhatsApp oficial). */
export async function notifyAppointment(appointmentId: string, event: AppointmentEvent, opts: { manageToken?: string } = {}) {
  const a = await load(appointmentId);
  if (!a || !a.client) return;
  const key = templateFor(event, a.status, a.deposit_status);
  if (!key) return;
  // Pós-procedimento só é enviado se o serviço tiver orientações cadastradas.
  if (key === "orientacoes_pos" && !a.service?.post_care_text) return;
  const db = createServiceClient();
  const { data: settings } = await db.from("notification_settings").select("*").eq("business_id", a.business_id).maybeSingle();
  if (!settings) return;

  const flag: Record<AppointmentEvent, boolean> = {
    booking: settings.email_on_booking,
    confirm: settings.email_on_confirm,
    cancel: settings.email_on_cancel,
    reschedule: settings.email_on_reschedule,
    update: false,
    complete: settings.email_on_confirm,
    reminder_day_before: settings.email_reminder_day_before,
    reminder_2h: settings.email_reminder_2h,
  };
  const dedupe = (channel: string) => `${a.id}:${channel}:${event}:${a.starts_at}`;
  const manageUrl = opts.manageToken ? `${SITE_URL}/agendamento/${opts.manageToken}` : undefined;
  const tz = a.business.timezone;
  const { data: bs } = await db
    .from("booking_settings")
    .select("pix_key, pix_key_type, pix_holder_name, pix_bank")
    .eq("business_id", a.business_id)
    .maybeSingle();
  const pixText = bs?.pix_key
    ? `Chave (${PIX_KEY_TYPE_LABEL[bs.pix_key_type ?? ""] ?? "Pix"}): ${formatPixKey(bs.pix_key, bs.pix_key_type)}${bs.pix_holder_name ? `\nFavorecida: ${bs.pix_holder_name}` : ""}${bs.pix_bank ? `\nBanco: ${bs.pix_bank}` : ""}`
    : "";
  const text = renderTemplate(
    key,
    {
      nome: a.client.full_name,
      servico: a.service_name,
      startsAt: a.starts_at,
      tz,
      empresa: a.business.name,
      link: manageUrl,
      sinal: formatMoney(a.deposit_cents),
      pix: pixText,
      orientacoes: (key === "orientacoes_pos" ? a.service?.post_care_text : a.service?.pre_care_text) ?? "",
    },
    settings.templates as Templates,
  );
  // Orientações pré-procedimento acompanham a confirmação.
  const preCare = (key === "confirmacao" || key === "sinal" || key === "recebido") && a.service?.pre_care_text ? a.service.pre_care_text : null;

  async function already(channel: string) {
    const { count } = await db.from("message_logs").select("id", { count: "exact", head: true }).eq("dedupe_key", dedupe(channel)).eq("status", "sent");
    return (count ?? 0) > 0;
  }
  async function log(channel: "email" | "whatsapp_api", status: "sent" | "failed" | "skipped", recipient: string, extra: { id?: string; error?: string }) {
    await db.from("message_logs").insert({
      business_id: a!.business_id,
      appointment_id: a!.id,
      channel,
      template: key!,
      dedupe_key: status === "sent" ? dedupe(channel) : null,
      recipient,
      status,
      provider_message_id: extra.id ?? null,
      error: extra.error?.slice(0, 500) ?? null,
    });
  }

  // ---------- E-mail ----------
  if (settings.email_enabled && flag[event] && a.client.email && emailConfig().configured && !(await already("email"))) {
    const address = businessAddress(a.business);
    const html = renderEmailHtml({
      businessName: a.business.name,
      logoUrl: a.business.logo_url,
      title: SUBJECTS[key],
      message: preCare ? `${text}\n\nOrientações para o seu atendimento:\n${preCare}` : text,
      details: [
        ["Serviço", a.service_name],
        ["Data", formatDate(a.starts_at, tz)],
        ["Horário", `${formatTime(a.starts_at, tz)} às ${formatTime(a.ends_at, tz)}`],
        ["Duração", formatDuration(a.duration_minutes)],
        ["Referência", a.reference_code],
        ...(a.deposit_status === "aguardando" ? ([["Sinal (Pix)", formatMoney(a.deposit_cents)]] as [string, string][]) : []),
        ...(address ? ([["Endereço", address]] as [string, string][]) : []),
      ],
      ctaLabel: manageUrl ? "Gerenciar meu agendamento" : undefined,
      ctaUrl: manageUrl,
      footer: a.business.whatsapp_phone ? `${a.business.name} · WhatsApp ${formatPhone(a.business.whatsapp_phone)}` : a.business.name,
    });
    const r = await sendEmail({
      to: a.client.email,
      subject: `${SUBJECTS[key]} — ${a.business.name}`,
      html,
      text: `${preCare ? `${text}\n\nOrientações para o seu atendimento:\n${preCare}` : text}${manageUrl ? `\n\nGerenciar: ${manageUrl}` : ""}`,
      replyTo: settings.email_reply_to ?? a.business.email,
      fromName: a.business.name,
    });
    await log("email", r.ok ? "sent" : r.skipped ? "skipped" : "failed", a.client.email, r.ok ? { id: r.id } : { error: r.error });
  }

  // ---------- WhatsApp oficial (somente se ativado após teste real) ----------
  if (settings.whatsapp_api_enabled && whatsappCloudConfig().configured && !isAnonymizedPhone(a.client.phone) && !(await already("whatsapp_api"))) {
    const r = await sendWhatsappTemplate(a.client.phone, key, [
      a.client.full_name.split(" ")[0],
      a.service_name,
      formatDate(a.starts_at, tz),
      formatTime(a.starts_at, tz),
      ...(key === "sinal" ? [formatMoney(a.deposit_cents)] : []),
    ]);
    if (!r.skipped) await log("whatsapp_api", r.ok ? "sent" : "failed", a.client.phone, r.ok ? { id: r.id } : { error: r.error });
  }
}

/** Ponto único chamado após qualquer alteração de agendamento. Nunca lança erro. */
export async function afterAppointmentChange(appointmentId: string, event: AppointmentEvent, opts: { manageToken?: string } = {}) {
  await Promise.allSettled([syncAppointmentToGoogle(appointmentId), notifyAppointment(appointmentId, event, opts)]);
}
