import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Download, Scale, TicketPercent, Wallet } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { ExpenseList, FinanceActions, IncomeList, type ExpenseRow, type IncomeRow } from "@/components/admin/finance-manager";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { formatDateKey, formatMoney, localToUtcIso, toLocalDateKey, todayKey } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Financeiro" };

interface Summary {
  recebido_cents: number;
  estornos_cents: number;
  despesas_pagas_cents: number;
  despesas_mes_cents: number;
  despesas_a_pagar_cents: number;
  despesas_vencidas_cents: number;
  despesas_vencidas_qtd: number;
  faturamento_previsto_cents: number;
  a_receber_cents: number;
  descontos_cupons_cents: number;
  atendimentos_concluidos: number;
  ticket_medio_cents: number;
  por_forma: { nome: string; total: number }[];
  por_servico: { nome: string; total: number }[];
  despesas_por_categoria: { nome: string; total: number }[];
  serie: { mes: string; receitas: number; despesas: number }[];
}

function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function Bars({ items, total, color, label }: { items: { nome: string; total: number }[]; total: number; color: string; label?: (n: string) => string }) {
  if (!items.length) return <p className="py-4 text-center text-sm text-muted">Sem dados neste mês.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.nome}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate">{label ? label(i.nome) : i.nome}</span>
            <span className="tabular-nums text-muted">{formatMoney(i.total)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-cream">
            <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(3, (i.total / (total || 1)) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const ctx = await requireAdmin({ owner: true });
  const tz = ctx.business.timezone;
  const today = todayKey(tz);
  const month = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : today.slice(0, 7);
  const monthStart = `${month}-01`;
  const nextMonthStart = `${shiftMonth(month, 1)}-01`;

  const [{ data: summary, error }, { data: expenses }, { data: overdue }, { data: payments }] = await Promise.all([
    ctx.supabase.rpc("admin_finance_summary", { p_business_id: ctx.business.id, p_month: monthStart }),
    ctx.supabase.from("expenses").select("*").eq("business_id", ctx.business.id).gte("due_date", monthStart).lt("due_date", nextMonthStart).order("due_date"),
    ctx.supabase.from("expenses").select("*").eq("business_id", ctx.business.id).lt("due_date", monthStart).lt("due_date", today).is("paid_at", null).order("due_date"),
    ctx.supabase
      .from("payments")
      .select("id, kind, method, amount_cents, paid_at, description, notes, appointment_id, appointment:appointments(service_name, client:clients(full_name))")
      .eq("business_id", ctx.business.id)
      .gte("paid_at", localToUtcIso(monthStart, "00:00", tz))
      .lt("paid_at", localToUtcIso(nextMonthStart, "00:00", tz))
      .order("paid_at", { ascending: false }),
  ]);
  const s = (summary ?? {}) as Summary;
  const incomes: IncomeRow[] = ((payments ?? []) as unknown as (IncomeRow & { appointment: { service_name: string; client: { full_name: string } | null } | null })[]).map((p) => ({
    ...p,
    date_key: toLocalDateKey(p.paid_at, tz),
    label: p.appointment ? `${p.appointment.service_name} — ${p.appointment.client?.full_name ?? ""}` : (p.description ?? p.notes ?? "Receita avulsa"),
  }));
  const liquido = (s.recebido_cents ?? 0) - (s.estornos_cents ?? 0);
  const resultado = liquido - (s.despesas_pagas_cents ?? 0);
  const maxSerie = Math.max(1, ...(s.serie ?? []).flatMap((x) => [x.receitas, x.despesas]));
  const monthLabel = formatDateKey(monthStart, "MMMM 'de' yyyy");

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Receitas, despesas e resultado do studio."
        actions={
          <>
            <FinanceActions today={today} />
            <Button asChild size="sm" variant="ghost">
              <Link href={`/admin/exportar/financeiro.csv?mes=${month}`} prefetch={false}>
                <Download /> CSV do mês
              </Link>
            </Button>
          </>
        }
      />
      {error ? <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">Não foi possível carregar o resumo financeiro.</p> : null}

      <div className="mb-5 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Mês anterior">
          <Link href={`/admin/financeiro?mes=${shiftMonth(month, -1)}`}>
            <ChevronLeft />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon" aria-label="Próximo mês">
          <Link href={`/admin/financeiro?mes=${shiftMonth(month, 1)}`}>
            <ChevronRight />
          </Link>
        </Button>
        <h2 className="font-display text-xl text-ink first-letter:uppercase">{monthLabel}</h2>
        {month !== today.slice(0, 7) ? (
          <Button asChild size="sm" variant="outline" className="ml-2">
            <Link href="/admin/financeiro">Mês atual</Link>
          </Button>
        ) : null}
      </div>

      {(s.despesas_vencidas_qtd ?? 0) > 0 ? (
        <p className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle className="size-4 shrink-0" /> {s.despesas_vencidas_qtd} despesa(s) vencida(s) sem pagamento: {formatMoney(s.despesas_vencidas_cents)}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="kpis-financeiro">
        {[
          { label: "Receitas recebidas", value: liquido, icon: ArrowUpRight, tone: "text-emerald-800", hint: s.estornos_cents ? `${formatMoney(s.estornos_cents)} em estornos já descontados` : "pagamentos registrados" },
          { label: "Despesas pagas", value: s.despesas_pagas_cents ?? 0, icon: ArrowDownRight, tone: "text-rose-700", hint: `${formatMoney(s.despesas_a_pagar_cents ?? 0)} ainda a pagar no mês` },
          { label: "Resultado do mês", value: resultado, icon: Scale, tone: resultado >= 0 ? "text-gold-deep" : "text-rose-700", hint: "recebido − despesas pagas" },
          { label: "A receber", value: s.a_receber_cents ?? 0, icon: Wallet, tone: "text-amber-800", hint: "atendimentos concluídos sem pagamento total" },
        ].map((k) => (
          <div key={k.label} className="card-premium p-4 sm:p-5" data-testid={`kpi-${k.label}`}>
            <div className="flex items-start justify-between">
              <p className="text-[12.5px] text-muted">{k.label}</p>
              <k.icon className="size-4 text-champagne" />
            </div>
            <p className={cn("mt-2 font-display text-2xl", k.tone)}>{formatMoney(k.value)}</p>
            <p className="mt-1 text-[11.5px] text-muted">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Faturamento previsto", formatMoney(s.faturamento_previsto_cents ?? 0), "agendamentos do mês"],
          ["Ticket médio", formatMoney(s.ticket_medio_cents ?? 0), `${s.atendimentos_concluidos ?? 0} atendimento(s) concluído(s)`],
          ["Despesas do mês", formatMoney(s.despesas_mes_cents ?? 0), "pagas + a pagar"],
          ["Descontos com cupons", formatMoney(s.descontos_cupons_cents ?? 0), "concedidos no mês"],
        ].map(([l, v, h]) => (
          <div key={l} className="rounded-2xl border border-line bg-white/70 p-4">
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              {l === "Descontos com cupons" ? <TicketPercent className="size-3.5" /> : null}
              {l}
            </p>
            <p className="mt-1 font-display text-lg text-ink">{v}</p>
            <p className="text-[11px] text-muted">{h}</p>
          </div>
        ))}
      </div>

      <div className="card-premium mt-5 p-5 sm:p-6">
        <p className="font-display text-lg">Últimos 6 meses</p>
        <div className="mt-4 flex h-44 items-end gap-3 sm:gap-6" role="img" aria-label="Receitas e despesas dos últimos 6 meses">
          {(s.serie ?? []).map((x) => (
            <div key={x.mes} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-36 w-full items-end justify-center gap-1">
                <div className="w-1/2 max-w-6 rounded-t-md bg-[linear-gradient(180deg,#c9a35f,#92702e)]" style={{ height: `${(x.receitas / maxSerie) * 100}%` }} title={`Receitas ${formatMoney(x.receitas)}`} />
                <div className="w-1/2 max-w-6 rounded-t-md bg-rose-300" style={{ height: `${(x.despesas / maxSerie) * 100}%` }} title={`Despesas ${formatMoney(x.despesas)}`} />
              </div>
              <span className={cn("text-[11px] capitalize", x.mes === month ? "font-semibold text-gold-dark" : "text-muted")}>{formatDateKey(`${x.mes}-01`, "MMM")}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-gold" /> Receitas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-rose-300" /> Despesas pagas
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="card-premium p-5 sm:p-6">
          <p className="mb-3 font-display text-lg">Receita por serviço</p>
          <Bars items={s.por_servico ?? []} total={s.por_servico?.[0]?.total ?? 1} color="bg-[linear-gradient(90deg,#c9a35f,#92702e)]" />
        </div>
        <div className="card-premium p-5 sm:p-6">
          <p className="mb-3 font-display text-lg">Por forma de pagamento</p>
          <Bars items={s.por_forma ?? []} total={s.por_forma?.[0]?.total ?? 1} color="bg-emerald-400" label={(n) => PAYMENT_METHOD_LABEL[n as PaymentMethod] ?? n} />
        </div>
        <div className="card-premium p-5 sm:p-6">
          <p className="mb-3 font-display text-lg">Despesas por categoria</p>
          <Bars items={s.despesas_por_categoria ?? []} total={s.despesas_por_categoria?.[0]?.total ?? 1} color="bg-rose-300" />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {(overdue ?? []).length ? (
            <ExpenseList expenses={(overdue ?? []) as ExpenseRow[]} today={today} title="Vencidas de meses anteriores" empty="" />
          ) : null}
          <ExpenseList expenses={(expenses ?? []) as ExpenseRow[]} today={today} title="Despesas do mês" empty="Nenhuma despesa lançada neste mês." />
        </div>
        <IncomeList incomes={incomes} />
      </div>
      <p className="mt-4 text-[12px] text-muted">
        Pagamentos de atendimentos (inclusive sinais) são registrados na tela do agendamento e aparecem aqui automaticamente.
      </p>
    </>
  );
}
