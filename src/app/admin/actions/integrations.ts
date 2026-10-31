"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { disconnect, listCalendars, selectCalendar } from "@/lib/google-calendar";
import { syncAppointmentToGoogle } from "@/lib/appointment-events";
import { emailConfig, renderEmailHtml, sendEmail } from "@/lib/email";
import { sendWhatsappTemplate, whatsappCloudConfig } from "@/lib/whatsapp-cloud";
import { normalizeBrazilPhone } from "@/lib/phone";
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/templates";
import { friendlyDbError } from "@/lib/constants";
import type { ActionResult } from "@/lib/action";

function refresh() {
  revalidatePath("/admin/integracoes");
  revalidatePath("/admin/comunicacao");
}

export async function listGoogleCalendarsAction(): Promise<ActionResult<{ id: string; summary: string; primary: boolean }[]>> {
  try {
    const ctx = await assertAdmin({ owner: true });
    return { ok: true, data: await listCalendars(ctx.business.id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível listar as agendas." };
  }
}

export async function selectGoogleCalendarAction(id: string, summary: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const v = z.object({ id: z.string().min(1).max(300), summary: z.string().max(300) }).safeParse({ id, summary });
    if (!v.success) return { ok: false, error: "Agenda inválida." };
    const calendars = await listCalendars(ctx.business.id);
    if (!calendars.some((c) => c.id === v.data.id)) return { ok: false, error: "Agenda não encontrada nesta conta." };
    await selectCalendar(ctx.business.id, v.data.id, v.data.summary);
    refresh();
    return { ok: true, message: "Agenda selecionada." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function disconnectGoogleAction(): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    await disconnect(ctx.business.id);
    refresh();
    return { ok: true, message: "Google Agenda desconectado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

/** Envia ao Google todos os agendamentos futuros confirmados. */
export async function syncUpcomingAction(): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const db = createServiceClient();
    const { data } = await db
      .from("appointments")
      .select("id")
      .eq("business_id", ctx.business.id)
      .gte("starts_at", new Date().toISOString())
      .in("status", ["confirmed", "in_progress"])
      .limit(200);
    for (const a of data ?? []) await syncAppointmentToGoogle(a.id);
    const { count } = await db
      .from("sync_logs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.business.id)
      .eq("ok", false)
      .gte("created_at", new Date(Date.now() - 60000).toISOString());
    refresh();
    return count
      ? { ok: false, error: `${count} falha(s) de sincronização. Veja o registro abaixo.` }
      : { ok: true, message: `${data?.length ?? 0} agendamento(s) sincronizado(s).` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function sendTestEmailAction(to: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const email = z.email().safeParse(to.trim());
    if (!email.success) return { ok: false, error: "E-mail inválido." };
    if (!emailConfig().configured) return { ok: false, error: `E-mail não configurado no servidor (faltam: ${emailConfig().missing.join(", ")}).` };
    const r = await sendEmail({
      to: email.data,
      subject: `Teste de e-mail — ${ctx.business.name}`,
      text: "Este é um e-mail de teste do Studio Manager. Se você recebeu, o envio está funcionando. ✨",
      html: renderEmailHtml({
        businessName: ctx.business.name,
        logoUrl: ctx.business.logo_url,
        title: "E-mail de teste ✨",
        message: "Se você recebeu esta mensagem, os e-mails automáticos do seu studio estão funcionando.",
        details: [["Enviado em", new Date().toLocaleString("pt-BR", { timeZone: ctx.business.timezone })]],
      }),
      fromName: ctx.business.name,
    });
    const db = createServiceClient();
    await db.from("message_logs").insert({
      business_id: ctx.business.id,
      channel: "email",
      template: "teste",
      recipient: email.data,
      status: r.ok ? "sent" : "failed",
      provider_message_id: r.ok ? r.id : null,
      error: r.ok ? null : r.error,
    });
    refresh();
    return r.ok ? { ok: true, message: "E-mail de teste enviado. Confira a caixa de entrada." } : { ok: false, error: `Falha no envio: ${r.error}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

export async function sendTestWhatsappAction(phone: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const n = normalizeBrazilPhone(phone);
    if (!n) return { ok: false, error: "WhatsApp inválido." };
    const c = whatsappCloudConfig();
    if (!c.configured || !c.templates.confirmacao) return { ok: false, error: "WhatsApp API não configurada (token, número e modelo de confirmação)." };
    const r = await sendWhatsappTemplate(n, "confirmacao", ["Teste", "Serviço de teste", "01/01/2030", "10:00"]);
    const db = createServiceClient();
    await db.from("message_logs").insert({
      business_id: ctx.business.id,
      channel: "whatsapp_api",
      template: "teste",
      recipient: n,
      status: r.ok ? "sent" : "failed",
      provider_message_id: r.ok ? r.id : null,
      error: r.ok ? null : r.error,
    });
    if (r.ok) await db.from("notification_settings").update({ whatsapp_api_tested_at: new Date().toISOString() }).eq("business_id", ctx.business.id);
    refresh();
    return r.ok
      ? { ok: true, message: "Mensagem de teste enviada. Confirme o recebimento antes de ativar o envio automático." }
      : { ok: false, error: `Falha: ${r.error}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

const templateKeys = Object.keys(DEFAULT_TEMPLATES) as TemplateKey[];
const settingsSchema = z.object({
  emailEnabled: z.boolean(),
  emailReplyTo: z.union([z.email(), z.literal("")]).optional().default(""),
  emailOnBooking: z.boolean(),
  emailOnConfirm: z.boolean(),
  emailOnCancel: z.boolean(),
  emailOnReschedule: z.boolean(),
  emailReminderDayBefore: z.boolean(),
  emailReminder2h: z.boolean(),
  whatsappApiEnabled: z.boolean(),
  templates: z.record(z.string(), z.string().max(1000)).optional().default({}),
});
export type NotificationSettingsInput = z.input<typeof settingsSchema>;

export async function saveNotificationSettingsAction(input: NotificationSettingsInput): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const p = settingsSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0].message };
    const v = p.data;
    const templates: Record<string, string> = {};
    for (const k of templateKeys) {
      const t = (v.templates[k] ?? "").trim();
      if (t && t !== DEFAULT_TEMPLATES[k]) templates[k] = t;
    }
    if (v.whatsappApiEnabled && !whatsappCloudConfig().configured) {
      return { ok: false, error: "A API oficial do WhatsApp ainda não está configurada no servidor." };
    }
    const { error } = await ctx.supabase
      .from("notification_settings")
      .update({
        email_enabled: v.emailEnabled,
        email_reply_to: v.emailReplyTo || null,
        email_on_booking: v.emailOnBooking,
        email_on_confirm: v.emailOnConfirm,
        email_on_cancel: v.emailOnCancel,
        email_on_reschedule: v.emailOnReschedule,
        email_reminder_day_before: v.emailReminderDayBefore,
        email_reminder_2h: v.emailReminder2h,
        whatsapp_api_enabled: v.whatsappApiEnabled,
        templates,
      })
      .eq("business_id", ctx.business.id);
    if (error) {
      if (error.message.includes("WHATSAPP_NAO_TESTADO")) return { ok: false, error: "Envie e confirme uma mensagem de teste antes de ativar o WhatsApp automático." };
      return { ok: false, error: friendlyDbError(error.message) };
    }
    refresh();
    return { ok: true, message: "Comunicação salva." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
