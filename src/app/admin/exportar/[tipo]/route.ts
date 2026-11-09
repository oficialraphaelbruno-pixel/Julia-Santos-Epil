import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth";
import { formatDate, formatTime, localToUtcIso } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, STATUS_LABEL, type AppointmentStatus } from "@/lib/constants";

function csv(rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // evita injeção de fórmulas em planilhas
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
}

/** Exportação CSV (padrão brasileiro: separador ";"). Somente membros autenticados. */
export async function GET(req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) return new NextResponse("Não autorizado", { status: 401 });
  const { tipo } = await params;
  const tz = ctx.business.timezone;
  let body: string;

  if (tipo === "clientes.csv") {
    const { data } = await ctx.supabase
      .from("client_overview")
      .select("full_name, phone, email, birthday, created_at, completed_count, total_spent_cents, last_visit, marketing_consent")
      .eq("business_id", ctx.business.id)
      .order("full_name");
    body = csv([
      ["Nome", "WhatsApp", "E-mail", "Aniversário", "Cadastro", "Atendimentos concluídos", "Total gasto (R$)", "Última visita", "Aceita mensagens"],
      ...(data ?? []).map((c) => [
        c.full_name,
        c.phone,
        c.email,
        c.birthday ? c.birthday.split("-").reverse().join("/") : "",
        formatDate(c.created_at, tz),
        c.completed_count,
        (c.total_spent_cents / 100).toFixed(2).replace(".", ","),
        c.last_visit ? formatDate(c.last_visit, tz) : "",
        c.marketing_consent ? "Sim" : "Não",
      ]),
    ]);
  } else if (tipo === "agendamentos.csv") {
    const { data } = await ctx.supabase
      .from("appointments")
      .select("reference_code, starts_at, ends_at, status, service_name, price_cents, source, client:clients(full_name, phone)")
      .eq("business_id", ctx.business.id)
      .order("starts_at", { ascending: false })
      .limit(10000);
    body = csv([
      ["Referência", "Data", "Início", "Fim", "Cliente", "WhatsApp", "Serviço", "Valor (R$)", "Situação", "Origem"],
      ...((data ?? []) as unknown as { reference_code: string; starts_at: string; ends_at: string; status: AppointmentStatus; service_name: string; price_cents: number; source: string; client: { full_name: string; phone: string } | null }[]).map((a) => [
        a.reference_code,
        formatDate(a.starts_at, tz),
        formatTime(a.starts_at, tz),
        formatTime(a.ends_at, tz),
        a.client?.full_name,
        a.client?.phone,
        a.service_name,
        (a.price_cents / 100).toFixed(2).replace(".", ","),
        STATUS_LABEL[a.status],
        a.source === "online" ? "Site" : "Painel",
      ]),
    ]);
  } else if (tipo === "financeiro.csv") {
    if (ctx.role !== "owner") return new NextResponse("Não autorizado", { status: 403 });
    const mes = new URL(req.url).searchParams.get("mes") ?? "";
    if (!/^\d{4}-\d{2}$/.test(mes)) return new NextResponse("Mês inválido", { status: 400 });
    const [y, m] = mes.split("-").map(Number);
    const start = `${mes}-01`;
    const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const [{ data: pays }, { data: exps }] = await Promise.all([
      ctx.supabase
        .from("payments")
        .select("kind, method, amount_cents, paid_at, description, notes, appointment:appointments(service_name, client:clients(full_name))")
        .eq("business_id", ctx.business.id)
        .gte("paid_at", localToUtcIso(start, "00:00", tz))
        .lt("paid_at", localToUtcIso(next, "00:00", tz))
        .order("paid_at"),
      ctx.supabase.from("expenses").select("*").eq("business_id", ctx.business.id).gte("due_date", start).lt("due_date", next).order("due_date"),
    ]);
    const money = (c: number) => (c / 100).toFixed(2).replace(".", ",");
    body = csv([
      ["Tipo", "Data", "Descrição", "Categoria", "Forma", "Valor (R$)", "Situação"],
      ...((pays ?? []) as unknown as { kind: string; method: string; amount_cents: number; paid_at: string; description: string | null; notes: string | null; appointment: { service_name: string; client: { full_name: string } | null } | null }[]).map((p) => [
        p.kind === "estorno" ? "Estorno" : "Receita",
        formatDate(p.paid_at, tz),
        p.appointment ? `${p.appointment.service_name} — ${p.appointment.client?.full_name ?? ""}` : (p.description ?? p.notes ?? "Receita avulsa"),
        p.appointment ? "Atendimento" : "Avulsa",
        PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method,
        (p.kind === "estorno" ? "-" : "") + money(p.amount_cents),
        "Recebido",
      ]),
      ...((exps ?? []) as { description: string; category: string; amount_cents: number; due_date: string; paid_at: string | null; method: string | null }[]).map((e) => [
        "Despesa",
        e.due_date.split("-").reverse().join("/"),
        e.description,
        e.category,
        e.method ? (PAYMENT_METHOD_LABEL[e.method as keyof typeof PAYMENT_METHOD_LABEL] ?? e.method) : "",
        "-" + money(e.amount_cents),
        e.paid_at ? `Paga em ${e.paid_at.split("-").reverse().join("/")}` : "A pagar",
      ]),
    ]);
  } else {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo.replace(".csv", "")}-${new URL(req.url).searchParams.get("mes") ?? new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
