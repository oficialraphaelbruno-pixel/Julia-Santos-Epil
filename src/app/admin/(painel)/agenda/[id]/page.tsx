import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Globe, MessageSquareText, NotebookPen, UserRound } from "lucide-react";
import { AppointmentForm } from "@/components/admin/appointment-form";
import { AppointmentStatusActions } from "@/components/admin/appointment-actions";
import { PaymentPanel, type PaymentRow } from "@/components/admin/payment-panel";
import { WhatsAppActions } from "@/components/admin/whatsapp-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { getProfessionals } from "@/lib/admin-data";
import { centsToInput, formatDate, formatDuration, formatLongDate, formatMoney, formatTime, toLocalDateKey } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { Appointment, Service } from "@/lib/types";

export const metadata: Metadata = { title: "Agendamento" };

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editar?: string }> }) {
  const { id } = await params;
  const { editar } = await searchParams;
  const ctx = await requireAdmin();
  const tz = ctx.business.timezone;
  const { data } = await ctx.supabase
    .from("appointments")
    .select("*, client:clients(id, full_name, phone, email), professional:professionals(id, display_name)")
    .eq("id", id)
    .eq("business_id", ctx.business.id)
    .maybeSingle();
  if (!data) notFound();
  const a = data as Appointment & {
    client: { id: string; full_name: string; phone: string; email: string | null };
    professional: { id: string; display_name: string } | null;
  };

  if (editar === "1") {
    const [{ data: services }, professionals] = await Promise.all([
      ctx.supabase.from("services").select("*").eq("business_id", ctx.business.id).neq("status", "archived").order("name"),
      getProfessionals(ctx),
    ]);
    return (
      <>
        <Link href={`/admin/agenda/${a.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-gold-dark hover:underline">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <h1 className="mb-6 text-3xl">Editar / reagendar</h1>
        <AppointmentForm
          services={(services ?? []) as Service[]}
          professionals={professionals}
          tz={tz}
          initial={{
            id: a.id,
            serviceId: a.service_id ?? "",
            client: a.client,
            professionalId: a.professional_id,
            date: toLocalDateKey(a.starts_at, tz),
            time: formatTime(a.starts_at, tz),
            status: a.status,
            price: centsToInput(a.price_cents),
            notes: a.notes ?? "",
          }}
        />
      </>
    );
  }

  const { data: payments } = await ctx.supabase
    .from("payments")
    .select("id, method, amount_cents, discount_cents, paid_at, kind")
    .eq("appointment_id", a.id)
    .order("paid_at");
  const active = a.status === "pending" || a.status === "confirmed";

  return (
    <>
      <Link href={`/admin/agenda?data=${toLocalDateKey(a.starts_at, tz)}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-gold-dark hover:underline">
        <ArrowLeft className="size-4" /> Agenda
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl text-ink">{a.service_name}</h1>
            <StatusBadge status={a.status} />
          </div>
          <p className="mt-1 text-[15px] text-muted first-letter:uppercase">
            {formatLongDate(a.starts_at, tz)} · {formatTime(a.starts_at, tz)}–{formatTime(a.ends_at, tz)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/agenda/${a.id}?editar=1`}>
            <CalendarClock /> Editar / reagendar
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <AppointmentStatusActions id={a.id} status={a.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4">
            <Link href={`/admin/clientes/${a.client.id}`} className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-cream text-gold-dark">
                <UserRound className="size-5" />
              </span>
              <span>
                <span className="block font-medium text-ink">{a.client.full_name}</span>
                <span className="text-[13px] text-muted">{formatPhone(a.client.phone)}</span>
              </span>
            </Link>
            <dl className="grid grid-cols-2 gap-3 border-t border-line/70 pt-4 text-sm">
              <div>
                <dt className="text-muted">Referência</dt>
                <dd className="font-mono font-medium">{a.reference_code}</dd>
              </div>
              <div>
                <dt className="text-muted">Origem</dt>
                <dd className="inline-flex items-center gap-1.5">{a.source === "online" ? <><Globe className="size-3.5 text-gold" /> Site</> : "Painel"}</dd>
              </div>
              <div>
                <dt className="text-muted">Valor</dt>
                <dd className="font-medium">{formatMoney(a.price_cents)}</dd>
              </div>
              <div>
                <dt className="text-muted">Duração</dt>
                <dd>{formatDuration(a.duration_minutes)}</dd>
              </div>
              {a.professional ? (
                <div>
                  <dt className="text-muted">Profissional</dt>
                  <dd>{a.professional.display_name}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted">Criado em</dt>
                <dd>{formatDate(a.created_at, tz)}</dd>
              </div>
            </dl>
            {a.client_message ? (
              <p className="flex gap-2 rounded-xl bg-ivory p-3 text-sm">
                <MessageSquareText className="mt-0.5 size-4 shrink-0 text-gold" /> <span><b className="font-medium">Mensagem da cliente:</b> {a.client_message}</span>
              </p>
            ) : null}
            {a.notes ? (
              <p className="flex gap-2 rounded-xl bg-ivory p-3 text-sm">
                <NotebookPen className="mt-0.5 size-4 shrink-0 text-gold" /> {a.notes}
              </p>
            ) : null}
            {a.status === "cancelled" ? (
              <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
                Cancelado {a.cancelled_by === "cliente" ? "pela cliente" : "pelo studio"}
                {a.cancel_reason ? `: ${a.cancel_reason}` : "."}
              </p>
            ) : null}
            {a.reschedule_count > 0 ? <p className="text-[13px] text-muted">Reagendado {a.reschedule_count}×.</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardContent>
              <p className="mb-3 font-display text-lg">WhatsApp</p>
              <WhatsAppActions
                phone={a.client.phone}
                name={a.client.full_name}
                businessName={ctx.business.name}
                service={a.service_name}
                startsAt={a.starts_at}
                tz={tz}
                templates={
                  active
                    ? ["personalizada", "confirmacao", "lembrete", "reagendamento"]
                    : a.status === "cancelled"
                      ? ["personalizada", "cancelamento"]
                      : ["personalizada"]
                }
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <PaymentPanel
                appointmentId={a.id}
                priceCents={a.price_cents}
                payments={(payments ?? []) as PaymentRow[]}
                tz={tz}
                isOwner={ctx.role === "owner"}
              />
              <p className="mt-3 text-[12px] text-muted">Registro manual. Relatórios financeiros completos chegam na Fase 3.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
