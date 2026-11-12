"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarPlus, Download, Loader2, Search, TicketPercent } from "lucide-react";
import { lookupBookingsAction, type FoundBooking } from "@/app/agendar/consulta-actions";
import { DepositCard } from "@/components/booking/deposit-card";
import { WhatsAppIcon } from "@/components/site/icons";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/input";
import { buildIcs, googleCalendarTemplateLink } from "@/lib/ics";
import { formatDate, formatDuration, formatLongDate, formatMoney, formatTime } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

export function ConsultBookings({
  slug,
  businessName,
  tz,
  whatsapp,
  location,
}: {
  slug: string;
  businessName: string;
  tz: string;
  whatsapp: string | null;
  /** Nome + endereço do studio, para o evento de agenda. */
  location: string | null;
}) {
  const [contact, setContact] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<FoundBooking[] | null>(null);
  const [pending, start] = useTransition();

  function downloadIcs(b: FoundBooking) {
    const ics = buildIcs({
      uid: `${b.reference}@studio-manager`,
      title: `${b.serviceName} — ${businessName}`,
      description: `Referência: ${b.reference}`,
      location,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `agendamento-${b.reference}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (found) {
    return (
      <div className="mx-auto max-w-xl space-y-5" data-testid="consulta-resultado">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-ink sm:text-3xl">Seus agendamentos</h1>
          <button type="button" className="text-sm text-gold-dark underline" onClick={() => setFound(null)}>
            Nova consulta
          </button>
        </div>
        {found.map((b) => {
          const active = b.status === "pending" || b.status === "confirmed";
          const event = { uid: b.reference, title: `${b.serviceName} — ${businessName}`, description: `Referência: ${b.reference}`, location, startsAt: b.startsAt, endsAt: b.endsAt };
          const minutes = Math.round((Date.parse(b.endsAt) - Date.parse(b.startsAt)) / 60000);
          return (
            <div key={b.reference} className="space-y-4">
              <div className="rounded-3xl border border-line bg-white p-6 shadow-soft" data-testid={`consulta-${b.reference}`}>
                <div className="flex items-center justify-between border-b border-line/70 pb-4">
                  <span className="font-mono text-base font-semibold tracking-wider text-gold-dark">{b.reference}</span>
                  <StatusBadge status={b.status} />
                </div>
                <dl className="mt-4 space-y-3 text-[15px]">
                  {[
                    ["Serviço", b.serviceName],
                    ["Data", `${formatDate(b.startsAt, tz)} — ${formatLongDate(b.startsAt, tz).split(",")[0]}`],
                    ["Horário", `${formatTime(b.startsAt, tz)} às ${formatTime(b.endsAt, tz)}`],
                    ["Duração", formatDuration(minutes)],
                    ["Valor", formatMoney(b.priceCents)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                  {b.couponCode ? (
                    <div className="flex justify-between gap-4 text-emerald-800">
                      <dt className="inline-flex items-center gap-1.5">
                        <TicketPercent className="size-4" /> Cupom {b.couponCode}
                      </dt>
                      <dd>−{formatMoney(b.discountCents)}</dd>
                    </div>
                  ) : null}
                </dl>
                {b.status === "pending" ? (
                  <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                    {b.deposit ? "Aguardando o pagamento do sinal para confirmar." : "Aguardando confirmação do studio."}
                  </p>
                ) : null}
                {b.depositStatus === "pago" ? <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">Sinal recebido. Obrigada! 💛</p> : null}
                {active ? (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={googleCalendarTemplateLink(event)} target="_blank" rel="noopener noreferrer" data-testid="consulta-google">
                        <CalendarPlus /> Adicionar ao Google Agenda
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadIcs(b)}>
                      <Download /> Apple / Outlook (.ics)
                    </Button>
                  </div>
                ) : null}
              </div>
              {b.deposit ? <DepositCard deposit={b.deposit} tz={tz} reference={b.reference} whatsapp={whatsapp} /> : null}
            </div>
          );
        })}
        <p className="text-center text-[13px] text-muted">
          Para remarcar ou cancelar, use o link recebido na confirmação do agendamento ou fale com o studio.
        </p>
        {whatsapp ? (
          <Button asChild variant="whatsapp" className="w-full">
            <a
              href={whatsappLink(whatsapp, `Olá! Gostaria de falar sobre meu agendamento ${found[0]?.reference ?? ""}.`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon /> Falar com o studio
            </a>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-gold shadow-soft">
          <Search className="size-5" />
        </span>
        <h1 className="mt-4 text-2xl text-ink sm:text-3xl">Consultar meu agendamento</h1>
        <p className="mt-2 text-sm text-muted">Use o mesmo e-mail (ou WhatsApp) e o nome completo informados no agendamento.</p>
      </div>
      <form
        className="space-y-4 rounded-3xl border border-line bg-white p-6 shadow-soft"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await lookupBookingsAction(slug, contact, fullName);
            if (r.ok && r.data) setFound(r.data);
            else if (!r.ok) setError(r.error);
          });
        }}
      >
        <Field label="E-mail ou WhatsApp" htmlFor="cs-contact">
          <Input id="cs-contact" autoComplete="email" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="seu@email.com ou (31) 99999-9999" required />
        </Field>
        <Field label="Nome completo" htmlFor="cs-name">
          <Input id="cs-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700" data-testid="consulta-erro">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" size="lg" disabled={pending} data-testid="consultar">
          {pending ? <Loader2 className="animate-spin" /> : <Search />} Consultar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        Ainda não agendou?{" "}
        <Link href={`/agendar/${slug}`} className="font-medium text-gold-dark underline underline-offset-4">
          Agendar um horário
        </Link>
      </p>
    </div>
  );
}
