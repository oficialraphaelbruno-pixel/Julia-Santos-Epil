import type { Metadata } from "next";
import Link from "next/link";
import { CalendarOff, ChevronLeft, ChevronRight, Globe, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { AgendaFilters } from "@/components/admin/agenda-filters";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { requireAdmin } from "@/lib/auth";
import { getProfessionals } from "@/lib/admin-data";
import { addDaysKey, formatDateKey, formatTime, localToUtcIso, toLocalDateKey, todayKey, weekdayOfKey } from "@/lib/format";
import { STATUS_DOT, type AppointmentStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Agenda" };

type View = "dia" | "semana" | "mes" | "lista";
const VIEWS: { key: View; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "lista", label: "Próximos" },
];
const HOUR_PX = 64;

interface Row {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  service_name: string;
  source: "admin" | "online";
  deposit_status: string;
  client: { full_name: string } | null;
}
interface BlockRow {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  kind: string;
}

function mondayOf(key: string) {
  const wd = weekdayOfKey(key);
  return addDaysKey(key, wd === 0 ? -6 : 1 - wd);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; data?: string; servico?: string; profissional?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireAdmin();
  const tz = ctx.business.timezone;
  const today = todayKey(tz);
  const view: View = (["dia", "semana", "mes", "lista"].includes(sp.view ?? "") ? sp.view : "dia") as View;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? sp.data! : today;

  let from: string, to: string;
  if (view === "dia") [from, to] = [date, addDaysKey(date, 1)];
  else if (view === "semana") {
    from = mondayOf(date);
    to = addDaysKey(from, 7);
  } else if (view === "mes") {
    from = mondayOf(date.slice(0, 8) + "01");
    const [y, m] = date.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    to = addDaysKey(last, 7 - (weekdayOfKey(last) === 0 ? 7 : weekdayOfKey(last)) + 1);
  } else [from, to] = [today, addDaysKey(today, 90)];

  const fromIso = view === "lista" ? new Date().toISOString() : localToUtcIso(from, "00:00", tz);
  const toIso = localToUtcIso(to, "00:00", tz);

  let q = ctx.supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, service_name, source, deposit_status, client:clients(full_name)")
    .eq("business_id", ctx.business.id)
    .gte("starts_at", fromIso)
    .lt("starts_at", toIso)
    .order("starts_at");
  if (sp.servico) q = q.eq("service_id", sp.servico);
  if (sp.profissional) q = q.eq("professional_id", sp.profissional);
  if (sp.status && sp.status !== "todos") q = q.eq("status", sp.status);
  else if (!sp.status) q = q.neq("status", "cancelled");
  if (view === "lista" && !sp.status) q = q.in("status", ["pending", "confirmed", "in_progress"]);

  const [{ data: appts }, { data: blocks }, { data: services }, professionals, { data: hours }] = await Promise.all([
    q,
    ctx.supabase
      .from("time_blocks")
      .select("id, starts_at, ends_at, reason, kind")
      .eq("business_id", ctx.business.id)
      .lt("starts_at", toIso)
      .gt("ends_at", fromIso),
    ctx.supabase.from("services").select("id, name").eq("business_id", ctx.business.id).neq("status", "archived").order("name"),
    getProfessionals(ctx),
    ctx.supabase.from("working_hours").select("is_open, open_time, close_time").eq("business_id", ctx.business.id).eq("is_open", true),
  ]);
  const rows = (appts ?? []) as unknown as Row[];
  const blockRows = (blocks ?? []) as BlockRow[];

  // Faixa de horas exibida (expediente configurado, ampliada para caber todos os atendimentos)
  let startHour = 8,
    endHour = 20;
  if (hours?.length) {
    startHour = Math.min(...hours.map((h) => Number(h.open_time!.slice(0, 2))));
    endHour = Math.max(...hours.map((h) => Math.ceil(Number(h.close_time!.slice(0, 2)) + Number(h.close_time!.slice(3, 5)) / 60)));
  }
  for (const r of rows) {
    startHour = Math.min(startHour, Number(formatTime(r.starts_at, tz).slice(0, 2)));
    const e = formatTime(r.ends_at, tz);
    endHour = Math.max(endHour, Math.ceil(Number(e.slice(0, 2)) + Number(e.slice(3)) / 60));
  }
  endHour = Math.min(Math.max(endHour, startHour + 1), 24);

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { view, data: date, servico: sp.servico ?? "", profissional: sp.profissional ?? "", status: sp.status ?? "", ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    return `/admin/agenda?${p.toString()}`;
  };
  const step = view === "dia" ? 1 : view === "semana" ? 7 : 0;
  const prev = view === "mes" ? shiftMonthKey(date, -1) : addDaysKey(date, -step);
  const next = view === "mes" ? shiftMonthKey(date, 1) : addDaysKey(date, step);

  const title =
    view === "dia"
      ? formatDateKey(date, "EEEE, dd 'de' MMMM")
      : view === "semana"
        ? `${formatDateKey(from, "dd/MM")} – ${formatDateKey(addDaysKey(from, 6), "dd/MM/yyyy")}`
        : view === "mes"
          ? formatDateKey(date, "MMMM 'de' yyyy")
          : "Próximos atendimentos";

  const byDay = (key: string) => rows.filter((r) => toLocalDateKey(r.starts_at, tz) === key);

  return (
    <>
      <PageHeader
        title="Agenda"
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/horarios?bloquear=1">
                <CalendarOff /> Bloquear horário
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/admin/agenda/novo?data=${date}`}>
                <Plus /> Novo agendamento
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-full border border-line bg-white p-1">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={link({ view: v.key })}
              className={cn("rounded-full px-4 py-1.5 text-sm transition", view === v.key ? "bg-ink text-white" : "text-ink/60 hover:text-ink")}
            >
              {v.label}
            </Link>
          ))}
        </div>
        <AgendaFilters services={(services ?? []) as { id: string; name: string }[]} professionals={professionals} />
      </div>

      {view !== "lista" ? (
        <div className="mb-4 flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Anterior">
            <Link href={link({ data: prev })}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Próximo">
            <Link href={link({ data: next })}>
              <ChevronRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={link({ data: today })}>Hoje</Link>
          </Button>
          <h2 className="ml-2 font-display text-xl text-ink first-letter:uppercase">{title}</h2>
        </div>
      ) : null}

      {/* ---------- DIA ---------- */}
      {view === "dia" ? (
        <div className="card-premium overflow-hidden">
          <TimeGrid
            days={[date]}
            rows={rows}
            blocks={blockRows}
            startHour={startHour}
            endHour={endHour}
            tz={tz}
            today={today}
          />
        </div>
      ) : null}

      {/* ---------- SEMANA ---------- */}
      {view === "semana" ? (
        <div className="card-premium overflow-x-auto">
          <div className="min-w-[760px]">
            <TimeGrid
              days={Array.from({ length: 7 }, (_, i) => addDaysKey(from, i))}
              rows={rows}
              blocks={blockRows}
              startHour={startHour}
              endHour={endHour}
              tz={tz}
              today={today}
              showHeader
            />
          </div>
        </div>
      ) : null}

      {/* ---------- MÊS ---------- */}
      {view === "mes" ? (
        <div className="card-premium overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line/70 bg-ivory/60 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: Math.round((Date.parse(to) - Date.parse(from)) / 864e5) }, (_, i) => addDaysKey(from, i)).map((d) => {
              const items = byDay(d);
              const outside = d.slice(0, 7) !== date.slice(0, 7);
              return (
                <Link
                  key={d}
                  href={link({ view: "dia", data: d })}
                  className={cn("min-h-24 border-b border-r border-line/60 p-1.5 transition hover:bg-ivory/60 sm:min-h-28 sm:p-2", outside && "bg-ivory/40 text-muted")}
                >
                  <span className={cn("inline-grid size-7 place-items-center rounded-full text-[13px]", d === today && "bg-gold text-white")}>
                    {Number(d.slice(8))}
                  </span>
                  <div className="mt-1 space-y-1">
                    {items.slice(0, 3).map((r) => (
                      <div key={r.id} className="flex items-center gap-1 truncate text-[11px] leading-tight">
                        <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[r.status])} />
                        <span className="hidden tabular-nums text-muted sm:inline">{formatTime(r.starts_at, tz)}</span>
                        <span className="truncate">{r.client?.full_name.split(" ")[0]}</span>
                      </div>
                    ))}
                    {items.length > 3 ? <p className="text-[11px] text-gold-dark">+{items.length - 3}</p> : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ---------- LISTA ---------- */}
      {view === "lista" ? (
        rows.length === 0 ? (
          <EmptyState title="Nenhum atendimento futuro" description="Os próximos agendamentos aparecerão aqui em ordem cronológica." />
        ) : (
          <div className="space-y-6">
            {[...new Set(rows.map((r) => toLocalDateKey(r.starts_at, tz)))].map((d) => (
              <div key={d}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">{formatDateKey(d, "EEEE, dd/MM")}</p>
                <div className="card-premium divide-y divide-line/70 overflow-hidden">
                  {byDay(d).map((r) => (
                    <AppointmentRow key={r.id} r={r} tz={tz} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {view === "dia" && rows.length > 0 ? (
        <div className="card-premium mt-5 divide-y divide-line/70 overflow-hidden">
          {rows.map((r) => (
            <AppointmentRow key={r.id} r={r} tz={tz} />
          ))}
        </div>
      ) : null}
    </>
  );
}

function shiftMonthKey(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}

function AppointmentRow({ r, tz }: { r: Row; tz: string }) {
  return (
    <Link href={`/admin/agenda/${r.id}`} className="flex items-center gap-4 px-4 py-3 transition hover:bg-ivory/60 sm:px-5">
      <span className="w-14 font-display text-lg tabular-nums text-gold-dark">{formatTime(r.starts_at, tz)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{r.client?.full_name}</p>
        <p className="truncate text-[13px] text-muted">
          {r.service_name} · até {formatTime(r.ends_at, tz)}
          {r.source === "online" ? <Globe className="ml-1.5 inline size-3 text-gold" aria-label="Agendado pelo site" /> : null}
        </p>
      </div>
      {r.deposit_status === "aguardando" && r.status === "pending" ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Sinal pendente</span>
      ) : null}
      <StatusBadge status={r.status} />
    </Link>
  );
}

function TimeGrid({
  days,
  rows,
  blocks,
  startHour,
  endHour,
  tz,
  today,
  showHeader,
}: {
  days: string[];
  rows: Row[];
  blocks: BlockRow[];
  startHour: number;
  endHour: number;
  tz: string;
  today: string;
  showHeader?: boolean;
}) {
  const hoursArr = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const minutesOf = (iso: string) => {
    const t = formatTime(iso, tz);
    return Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  };
  const height = hoursArr.length * HOUR_PX;

  return (
    <div>
      {showHeader ? (
        <div className="grid border-b border-line/70 bg-ivory/60" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
          <div />
          {days.map((d) => (
            <Link key={d} href={`/admin/agenda?view=dia&data=${d}`} className="py-2 text-center text-[12px] hover:text-gold-dark">
              <span className="uppercase tracking-wider text-muted">{formatDateKey(d, "EEE")}</span>{" "}
              <span className={cn("ml-1 inline-grid size-6 place-items-center rounded-full font-medium", d === today && "bg-gold text-white")}>{Number(d.slice(8))}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))`, height }}>
        <div className="relative">
          {hoursArr.map((h, i) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted" style={{ top: i * HOUR_PX }}>
              {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
            </span>
          ))}
        </div>
        {days.map((d) => {
          const dayStart = Date.parse(localToUtcIso(d, "00:00", tz));
          const dayEnd = Date.parse(localToUtcIso(addDaysKey(d, 1), "00:00", tz));
          return (
            <div key={d} className="relative border-l border-line/60">
              {hoursArr.map((h, i) => (
                <Link
                  key={h}
                  href={`/admin/agenda/novo?data=${d}&hora=${String(h).padStart(2, "0")}:00`}
                  className="absolute inset-x-0 border-t border-line/50 transition hover:bg-ivory/70"
                  style={{ top: i * HOUR_PX, height: HOUR_PX }}
                  aria-label={`Novo agendamento ${formatDateKey(d)} ${h}:00`}
                />
              ))}
              {blocks
                .filter((b) => Date.parse(b.starts_at) < dayEnd && Date.parse(b.ends_at) > dayStart)
                .map((b) => {
                  const s = Math.max(Date.parse(b.starts_at), dayStart);
                  const e = Math.min(Date.parse(b.ends_at), dayEnd);
                  const top = Math.max(0, ((s - dayStart) / 6e4 - startHour * 60) * (HOUR_PX / 60));
                  const bottom = Math.min(height, ((e - dayStart) / 6e4 - startHour * 60) * (HOUR_PX / 60));
                  if (bottom <= top) return null;
                  return (
                    <div
                      key={b.id}
                      className="pointer-events-none absolute inset-x-0.5 rounded-lg bg-[repeating-linear-gradient(135deg,rgba(201,163,95,0.12)_0_6px,transparent_6px_12px)] px-2 py-1 text-[11px] text-gold-dark"
                      style={{ top, height: bottom - top }}
                    >
                      {b.reason ?? "Bloqueado"}
                    </div>
                  );
                })}
              {rows
                .filter((r) => toLocalDateKey(r.starts_at, tz) === d)
                .map((r) => {
                  const top = (minutesOf(r.starts_at) - startHour * 60) * (HOUR_PX / 60);
                  const h = Math.max(26, (Date.parse(r.ends_at) - Date.parse(r.starts_at)) / 6e4 * (HOUR_PX / 60) - 2);
                  return (
                    <Link
                      key={r.id}
                      href={`/admin/agenda/${r.id}`}
                      className={cn(
                        "absolute inset-x-1 z-10 overflow-hidden rounded-xl border-l-[3px] bg-white px-2 py-1 text-[12px] leading-tight shadow-soft transition hover:shadow-lift",
                        r.status === "pending" ? "border-amber-400" : r.status === "completed" ? "border-stone-400 opacity-80" : r.status === "no_show" || r.status === "cancelled" ? "border-zinc-300 opacity-60" : "border-gold",
                      )}
                      style={{ top, height: h }}
                    >
                      <span className="font-semibold tabular-nums text-gold-dark">{formatTime(r.starts_at, tz)}</span>{" "}
                      <span className="font-medium text-ink">{r.client?.full_name.split(" ")[0]}</span>
                      <span className="block truncate text-muted">{r.service_name}</span>
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
