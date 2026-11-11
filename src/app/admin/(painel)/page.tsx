import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Coins,
  Receipt,
  Share2,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, formatTime, formatDateKey, toLocalDateKey, todayKey } from "@/lib/format";
import { SITE_URL } from "@/lib/env";
import { whatsappShareLink } from "@/lib/whatsapp";
import type { AppointmentStatus } from "@/lib/constants";

export const metadata: Metadata = { title: "Painel de Controle" };

interface Dashboard {
  hoje: number;
  proximos: number;
  pendentes: number;
  concluidos_mes: number;
  cancelados_mes: number;
  faltas_mes: number;
  clientes: number;
  clientes_novas_mes: number;
  recebido_mes_cents: number;
  previsto_mes_cents: number;
  ticket_medio_cents: number;
  servicos_top: { nome: string; total: number }[];
}

export default async function DashboardPage() {
  const ctx = await requireAdmin();
  const tz = ctx.business.timezone;
  const today = todayKey(tz);
  const [{ data: dash }, { data: upcoming }, { count: servicesCount }, { count: openDays }, { data: deposits }] = await Promise.all([
    ctx.supabase.rpc("admin_dashboard", { p_business_id: ctx.business.id }),
    ctx.supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, service_name, client:clients(full_name)")
      .eq("business_id", ctx.business.id)
      .gte("ends_at", new Date().toISOString())
      .in("status", ["pending", "confirmed", "in_progress"])
      .order("starts_at")
      .limit(8),
    ctx.supabase.from("services").select("id", { count: "exact", head: true }).eq("business_id", ctx.business.id).eq("status", "active"),
    ctx.supabase.from("working_hours").select("id", { count: "exact", head: true }).eq("business_id", ctx.business.id).eq("is_open", true),
    ctx.supabase
      .from("appointments")
      .select("id, starts_at, deposit_cents, deposit_due_at, client:clients(full_name)")
      .eq("business_id", ctx.business.id)
      .eq("deposit_status", "aguardando")
      .eq("status", "pending")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(10),
  ]);
  const pendingDeposits = (deposits ?? []) as unknown as { id: string; starts_at: string; deposit_cents: number; deposit_due_at: string | null; client: { full_name: string } | null }[];
  const d = (dash ?? {}) as Dashboard;
  const bookingUrl = `${SITE_URL}/agendar/${ctx.business.slug}`;
  const firstName = ctx.business.name.split(" ")[0];
  const month = formatDateKey(today, "MMMM");

  const stats = [
    { label: "Agendamentos de hoje", value: d.hoje ?? 0, icon: CalendarDays },
    { label: "Próximos atendimentos", value: d.proximos ?? 0, icon: CalendarClock, hint: d.pendentes ? `${d.pendentes} aguardando confirmação` : undefined },
    { label: `Concluídos em ${month}`, value: d.concluidos_mes ?? 0, icon: CalendarCheck2 },
    { label: "Clientes cadastradas", value: d.clientes ?? 0, icon: Users, hint: `${d.clientes_novas_mes ?? 0} novas este mês` },
    { label: `Cancelamentos em ${month}`, value: d.cancelados_mes ?? 0, icon: XCircle },
    { label: `Faltas em ${month}`, value: d.faltas_mes ?? 0, icon: UserX },
  ];
  const money = [
    { label: "Faturamento recebido", value: formatMoney(d.recebido_mes_cents), icon: Coins, hint: "pagamentos registrados no mês" },
    { label: "Faturamento previsto", value: formatMoney(d.previsto_mes_cents), icon: TrendingUp, hint: "agendamentos do mês (exceto cancelados/faltas)" },
    { label: "Ticket médio", value: formatMoney(d.ticket_medio_cents), icon: Receipt, hint: "atendimentos concluídos no mês" },
  ];
  const quick = [
    { href: "/admin/agenda/novo", label: "Novo agendamento", icon: CalendarPlus },
    { href: "/admin/clientes/novo", label: "Cadastrar cliente", icon: UserPlus },
    { href: "/admin/servicos?novo=1", label: "Novo serviço", icon: Sparkles },
    { href: "/admin/horarios?bloquear=1", label: "Bloquear horário", icon: CalendarOff },
    { href: "/admin/agenda", label: "Ver agenda", icon: CalendarDays },
    {
      href: whatsappShareLink(`Agende seu horário na ${ctx.business.name} ✨ ${bookingUrl}`),
      label: "Compartilhar link",
      icon: Share2,
      external: true,
    },
  ];
  const setup = [
    { done: (servicesCount ?? 0) > 0, label: "Cadastrar os serviços com valor e duração", href: "/admin/servicos" },
    { done: (openDays ?? 0) > 0, label: "Definir dias e horários de funcionamento", href: "/admin/horarios" },
    { done: Boolean(ctx.business.address_line || ctx.business.about_text), label: "Completar dados do studio (endereço, sobre)", href: "/admin/configuracoes" },
  ];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-[2rem] leading-tight text-ink sm:text-[2.4rem]">Olá, {firstName}! ✨</h1>
        <p className="mt-1.5 text-[15px] text-muted">Confira seus atendimentos e acompanhe o desempenho do seu studio.</p>
      </div>

      {setup.some((s) => !s.done) ? (
        <Card className="mb-6 border-champagne/60 bg-[linear-gradient(135deg,var(--color-white),var(--color-ivory))]">
          <CardContent>
            <p className="font-display text-lg">Primeiros passos</p>
            <p className="text-sm text-muted">Configure o essencial para começar a receber agendamentos.</p>
            <ul className="mt-4 space-y-2">
              {setup.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex items-center gap-3 text-sm hover:text-gold-dark">
                    {s.done ? <CheckCircle2 className="size-5 text-emerald-600" /> : <Circle className="size-5 text-champagne" />}
                    <span className={s.done ? "text-muted line-through" : "text-ink"}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {pendingDeposits.length ? (
        <Card className="mb-6 border-amber-300 bg-amber-50/40" data-testid="pending-deposits">
          <CardContent>
            <p className="font-display text-lg">Sinais aguardando Pix ({pendingDeposits.length})</p>
            <p className="text-sm text-muted">Confira o recebimento no banco e marque como recebido no agendamento.</p>
            <ul className="mt-3 divide-y divide-amber-200/70">
              {pendingDeposits.map((d) => (
                <li key={d.id}>
                  <Link href={`/admin/agenda/${d.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:opacity-80">
                    <span className="flex-1 truncate font-medium">{d.client?.full_name}</span>
                    <span className="text-muted">{formatDateKey(toLocalDateKey(d.starts_at, tz), "dd/MM")} {formatTime(d.starts_at, tz)}</span>
                    <span className="font-medium text-gold-deep">{formatMoney(d.deposit_cents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {quick.map((q) => (
          <Link
            key={q.label}
            href={q.href}
            {...(q.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-line bg-white p-3 text-center text-[12px] font-medium text-ink/80 shadow-soft transition hover:-translate-y-0.5 hover:border-champagne"
          >
            <span className="grid size-10 place-items-center rounded-full bg-ivory text-gold transition group-hover:bg-gold group-hover:text-white">
              <q.icon className="size-[18px]" />
            </span>
            {q.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card-premium p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <p className="text-[12.5px] text-muted">{s.label}</p>
              <s.icon className="size-4 text-champagne" />
            </div>
            <p className="mt-2 font-display text-3xl text-ink" data-testid={`stat-${s.label}`}>
              {s.value}
            </p>
            {s.hint ? <p className="mt-1 text-[12px] text-gold-dark">{s.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {money.map((s) => (
          <div key={s.label} className="card-premium bg-[linear-gradient(160deg,var(--color-white)_40%,var(--color-ivory))] p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <p className="text-[12.5px] text-muted">{s.label}</p>
              <s.icon className="size-4 text-gold" />
            </div>
            <p className="mt-2 font-display text-2xl text-gold-deep">{s.value}</p>
            <p className="mt-1 text-[11.5px] text-muted">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardContent>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg">Próximos atendimentos</p>
              <Link href="/admin/agenda?view=lista" className="text-sm text-gold-dark hover:underline">
                Ver todos
              </Link>
            </div>
            {(upcoming ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nenhum atendimento agendado.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {(upcoming as unknown as { id: string; starts_at: string; status: AppointmentStatus; service_name: string; client: { full_name: string } | null }[]).map((a) => {
                  const key = toLocalDateKey(a.starts_at, tz);
                  return (
                    <li key={a.id}>
                      <Link href={`/admin/agenda/${a.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                        <div className="w-16 text-center">
                          <p className="font-display text-lg tabular-nums text-gold-dark">{formatTime(a.starts_at, tz)}</p>
                          <p className="text-[11px] uppercase tracking-wider text-muted">{key === today ? "hoje" : formatDateKey(key, "dd/MM")}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{a.client?.full_name}</p>
                          <p className="truncate text-[13px] text-muted">{a.service_name}</p>
                        </div>
                        <StatusBadge status={a.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="mb-3 font-display text-lg">Serviços mais procurados</p>
            <p className="-mt-2 mb-3 text-[12px] text-muted">últimos 90 dias</p>
            {(d.servicos_top ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Ainda sem dados.</p>
            ) : (
              <ul className="space-y-3">
                {d.servicos_top.map((s) => {
                  const max = d.servicos_top[0].total || 1;
                  return (
                    <li key={s.nome}>
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{s.nome}</span>
                        <span className="tabular-nums text-muted">{s.total}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-cream">
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#c9a35f,#92702e)]" style={{ width: `${(s.total / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
