import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Cake, Mail, Phone } from "lucide-react";
import { ClientProfileActions } from "@/components/admin/client-profile-actions";
import { WhatsAppActions } from "@/components/admin/whatsapp-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateKey, formatDateTime, formatMoney, nowMs } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import type { Appointment, Client } from "@/lib/types";
import type { Templates } from "@/lib/templates";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, business, role } = await requireAdmin();
  const tz = business.timezone;
  const { data: client } = await supabase.from("client_overview").select("*").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!client) notFound();
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, starts_at, status, service_name, price_cents, reference_code")
    .eq("client_id", id)
    .order("starts_at", { ascending: false })
    .limit(100);
  const history = (appts ?? []) as Pick<Appointment, "id" | "starts_at" | "status" | "service_name" | "price_cents" | "reference_code">[];
  const now = nowMs();
  const upcoming = history.filter((a) => new Date(a.starts_at).getTime() > now && ["pending", "confirmed"].includes(a.status)).reverse();
  const past = history.filter((a) => !upcoming.includes(a));
  const { data: ns } = await supabase.from("notification_settings").select("templates").eq("business_id", business.id).maybeSingle();
  const c = client as Client & { last_visit: string | null; completed_count: number; total_spent_cents: number; marketing_consent_at: string | null };
  const inactive = c.last_visit && now - new Date(c.last_visit).getTime() > 90 * 864e5 && upcoming.length === 0;

  return (
    <>
      <Link href="/admin/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gold-dark hover:underline">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-cream font-display text-2xl text-gold-dark">{c.full_name.charAt(0)}</span>
          <div>
            <h1 className="text-3xl text-ink">{c.full_name}</h1>
            <p className="text-sm text-muted">
              Cliente desde {formatDate(c.created_at, tz)} · {c.source === "online" ? "cadastro pelo site" : "cadastro manual"}
              {c.completed_count >= 2 ? " · recorrente" : ""}
              {inactive ? " · inativa" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/admin/agenda/novo?cliente=${c.id}`}>
              <CalendarPlus /> Agendar
            </Link>
          </Button>
          <ClientProfileActions client={c} isOwner={role === "owner"} hasHistory={history.length > 0} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-center gap-3">
                <Phone className="size-4 text-gold" /> {formatPhone(c.phone)}
              </p>
              {c.email ? (
                <p className="flex items-center gap-3">
                  <Mail className="size-4 text-gold" /> {c.email}
                </p>
              ) : null}
              {c.birthday ? (
                <p className="flex items-center gap-3">
                  <Cake className="size-4 text-gold" /> {formatDateKey(c.birthday, "dd 'de' MMMM")}
                </p>
              ) : null}
              <p className="text-[13px] text-muted">
                Mensagens de relacionamento: {c.marketing_consent ? `autorizadas${c.marketing_consent_at ? ` em ${formatDate(c.marketing_consent_at, tz)}` : ""}` : "não autorizadas"}
              </p>
              {c.notes ? <p className="whitespace-pre-line rounded-xl bg-ivory p-3 text-ink/80">{c.notes}</p> : null}
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            {[
              ["Atendimentos", String(c.completed_count)],
              ["Total gasto", formatMoney(c.total_spent_cents)],
              ["Última visita", c.last_visit ? formatDate(c.last_visit, tz) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="card-premium p-4 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted">{k}</p>
                <p className="mt-1 font-display text-lg text-ink">{v}</p>
              </div>
            ))}
          </div>

          <Card>
            <CardContent>
              <p className="mb-3 font-display text-lg">WhatsApp</p>
              <WhatsAppActions
                phone={c.phone}
                name={c.full_name}
                businessName={business.name}
                custom={(ns?.templates as Templates) ?? null}
                templates={upcoming[0] ? ["personalizada", "confirmacao", "lembrete"] : ["personalizada"]}
                service={upcoming[0]?.service_name}
                startsAt={upcoming[0]?.starts_at}
                tz={tz}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent>
              <p className="mb-3 font-display text-lg">Próximos atendimentos</p>
              {upcoming.length === 0 ? <p className="text-sm text-muted">Nenhum agendamento futuro.</p> : null}
              <ul className="divide-y divide-line/70">
                {upcoming.map((a) => (
                  <AppointmentLine key={a.id} a={a} tz={tz} />
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="mb-3 font-display text-lg">Histórico</p>
              {past.length === 0 ? <p className="text-sm text-muted">Sem histórico ainda.</p> : null}
              <ul className="divide-y divide-line/70">
                {past.map((a) => (
                  <AppointmentLine key={a.id} a={a} tz={tz} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function AppointmentLine({
  a,
  tz,
}: {
  a: { id: string; starts_at: string; status: Appointment["status"]; service_name: string; price_cents: number };
  tz: string;
}) {
  return (
    <li>
      <Link href={`/admin/agenda/${a.id}`} className="flex items-center gap-3 py-3 text-sm hover:opacity-80">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{a.service_name}</p>
          <p className="text-[13px] text-muted">{formatDateTime(a.starts_at, tz)}</p>
        </div>
        <span className="text-[13px] text-ink/70">{formatMoney(a.price_cents)}</span>
        <StatusBadge status={a.status} />
      </Link>
    </li>
  );
}
