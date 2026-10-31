import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarPlus, Download } from "lucide-react";
import { BookingShell } from "@/components/booking/booking-wizard";
import { ManageBookingActions } from "@/components/booking/manage-booking";
import { WhatsAppIcon } from "@/components/site/icons";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { getBookingByToken } from "@/lib/manage-booking";
import { addDaysKey, formatDate, formatDuration, formatLongDate, formatMoney, formatTime, todayKey } from "@/lib/format";
import { googleCalendarTemplateLink } from "@/lib/ics";
import { whatsappLink } from "@/lib/whatsapp";
import { SITE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meu agendamento", robots: { index: false, follow: false } };

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const tz = b.business.timezone;
  const active = b.status === "pending" || b.status === "confirmed";
  const today = todayKey(tz);
  const waMsg = `Olá! Sobre meu agendamento ${b.reference_code} (${b.service_name}, ${formatDate(b.starts_at, tz)} às ${formatTime(b.starts_at, tz)}):`;

  return (
    <BookingShell business={b.business}>
      <div className="mx-auto max-w-xl">
        <p className="ornament">Meu agendamento</p>
        <h1 className="mt-4 text-3xl text-ink">Olá, {b.clientFirstName}! ✨</h1>

        <div className="mt-6 rounded-3xl border border-line bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between border-b border-line/70 pb-4">
            <span className="font-mono text-base font-semibold tracking-wider text-gold-dark">{b.reference_code}</span>
            <StatusBadge status={b.status} />
          </div>
          <dl className="mt-4 space-y-3 text-[15px]">
            {[
              ["Serviço", b.service_name],
              ["Data", `${formatDate(b.starts_at, tz)} — ${formatLongDate(b.starts_at, tz).split(",")[0]}`],
              ["Horário", `${formatTime(b.starts_at, tz)} às ${formatTime(b.ends_at, tz)}`],
              ["Duração", formatDuration(b.duration_minutes)],
              ["Valor", formatMoney(b.price_cents)],
              ...(b.professionalName ? [["Profissional", b.professionalName]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {b.status === "pending" ? (
            <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">Aguardando confirmação do studio.</p>
          ) : null}
        </div>

        {active ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button asChild variant="outline" size="sm">
              <a
                href={googleCalendarTemplateLink({
                  uid: b.reference_code,
                  title: `${b.service_name} — ${b.business.name}`,
                  description: `Referência: ${b.reference_code}\nGerenciar: ${SITE_URL}/agendamento/${token}`,
                  startsAt: b.starts_at,
                  endsAt: b.ends_at,
                })}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CalendarPlus /> Google Agenda
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/agendamento/${token}/ics`}>
                <Download /> Arquivo .ics
              </a>
            </Button>
          </div>
        ) : null}

        <ManageBookingActions
          token={token}
          tz={tz}
          canCancel={b.canCancel}
          canReschedule={b.canReschedule}
          todayKey={today}
          maxKey={addDaysKey(today, b.settings.max_advance_days)}
        />

        {active && (!b.canCancel || !b.canReschedule) ? (
          <p className="mt-5 text-center text-[13px] text-muted">
            {!b.canCancel && !b.canReschedule
              ? "O prazo para alterações online terminou. Para mudanças, fale com o studio."
              : "Algumas alterações só podem ser feitas diretamente com o studio."}
          </p>
        ) : null}

        {b.settings.cancellation_policy ? (
          <div className="mt-6 rounded-2xl bg-white/70 p-4 text-[13px] leading-relaxed text-ink/70">
            <p className="mb-1 font-medium text-ink">Política de cancelamento</p>
            <p className="whitespace-pre-line">{b.settings.cancellation_policy}</p>
          </div>
        ) : null}

        {b.business.whatsapp_phone ? (
          <Button asChild variant="whatsapp" className="mt-6 w-full">
            <a href={whatsappLink(b.business.whatsapp_phone, waMsg)} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> Falar com o studio
            </a>
          </Button>
        ) : null}
      </div>
    </BookingShell>
  );
}
