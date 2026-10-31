import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { CommunicationForm } from "@/components/admin/communication-form";
import { requireAdmin } from "@/lib/auth";
import { emailConfig } from "@/lib/email";
import { whatsappCloudConfig } from "@/lib/whatsapp-cloud";
import { formatDateTime } from "@/lib/format";
import { TEMPLATE_LABELS, type TemplateKey } from "@/lib/templates";

export const metadata: Metadata = { title: "Comunicação" };

const STATUS = { sent: ["Enviado", "text-emerald-700"], failed: ["Falhou", "text-rose-700"], skipped: ["Não enviado", "text-muted"] } as const;

export default async function CommunicationPage() {
  const ctx = await requireAdmin();
  const [{ data: s }, { data: logs }] = await Promise.all([
    ctx.supabase.from("notification_settings").select("*").eq("business_id", ctx.business.id).single(),
    ctx.supabase
      .from("message_logs")
      .select("id, channel, template, recipient, status, error, created_at")
      .eq("business_id", ctx.business.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const tz = ctx.business.timezone;
  return (
    <>
      <PageHeader title="Comunicação" description="Mensagens automáticas, modelos de texto e histórico de envios." />
      <CommunicationForm
        canEdit={ctx.role === "owner"}
        emailConfigured={emailConfig().configured}
        whatsappConfigured={whatsappCloudConfig().configured}
        whatsappTested={Boolean(s?.whatsapp_api_tested_at)}
        businessName={ctx.business.name}
        initial={{
          emailEnabled: s?.email_enabled ?? true,
          emailReplyTo: s?.email_reply_to ?? "",
          emailOnBooking: s?.email_on_booking ?? true,
          emailOnConfirm: s?.email_on_confirm ?? true,
          emailOnCancel: s?.email_on_cancel ?? true,
          emailOnReschedule: s?.email_on_reschedule ?? true,
          emailReminderDayBefore: s?.email_reminder_day_before ?? true,
          emailReminder2h: s?.email_reminder_2h ?? false,
          whatsappApiEnabled: s?.whatsapp_api_enabled ?? false,
          templates: (s?.templates as Record<string, string>) ?? {},
        }}
      />
      <section className="card-premium mt-6 p-5 sm:p-6">
        <h2 className="font-display text-lg">Histórico de envios automáticos</h2>
        <p className="text-[13px] text-muted">Mensagens abertas manualmente pelo WhatsApp não aparecem aqui, pois o envio é feito por você.</p>
        {(logs ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nenhum envio automático ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line/70 text-[13px]">
            {(logs ?? []).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className={STATUS[l.status as keyof typeof STATUS][1]}>{STATUS[l.status as keyof typeof STATUS][0]}</span>
                <span>{l.channel === "email" ? "E-mail" : "WhatsApp"}</span>
                <span className="text-ink/70">{TEMPLATE_LABELS[l.template as TemplateKey] ?? (l.template === "teste" ? "Teste" : l.template)}</span>
                <span className="text-muted">{l.recipient}</span>
                <span className="ml-auto text-muted">{formatDateTime(l.created_at, tz)}</span>
                {l.error ? <span className="w-full text-rose-700">{l.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
