import type { Metadata } from "next";
import Link from "next/link";
import { Download, Filter, Mail } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmailRemoveButton } from "@/components/admin/email-remove-button";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth";
import { formatDate, nowMs } from "@/lib/format";
import { filterContacts, loadEmailContacts, ORIGIN_LABEL, STATUS_LABEL, type EmailFilters } from "@/lib/email-list";

export const metadata: Metadata = { title: "E-mails (novidades)" };

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const KEYS = ["q", "origem", "situacao", "servico", "inativas", "aniversario"] as const;

export default async function EmailsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const filters: EmailFilters = Object.fromEntries(KEYS.map((k) => [k, typeof sp[k] === "string" ? (sp[k] as string) : undefined]));
  const [all, { data: services }] = await Promise.all([
    loadEmailContacts(ctx.supabase, ctx.business.id),
    ctx.supabase.from("services").select("name").eq("business_id", ctx.business.id).neq("status", "archived").order("sort_order").order("name"),
  ]);
  const rows = filterContacts(all, filters, nowMs());
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  const filtered = qs.length > 0;
  const canExport = ctx.canEdit("exportar");
  const tz = ctx.business.timezone;

  return (
    <>
      <PageHeader
        title="E-mails para novidades"
        description="Todas as pessoas que autorizaram receber novidades e promoções: no agendamento, na caixa “Fique por dentro” do site ou pela assistente. Filtre o público e baixe a lista para a campanha no Resend."
      />

      <form method="get" className="card-premium mb-5 grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3" data-testid="email-filtros">
        <Input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar nome ou e-mail" aria-label="Buscar" className="sm:col-span-2 lg:col-span-1" />
        <Select name="origem" defaultValue={filters.origem ?? "todas"} aria-label="Origem">
          <option value="todas">Todas as origens</option>
          {Object.entries(ORIGIN_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select name="situacao" defaultValue={filters.situacao ?? "todas"} aria-label="Situação">
          <option value="todas">Qualquer situação</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select name="servico" defaultValue={filters.servico ?? ""} aria-label="Serviço já feito">
          <option value="">Qualquer serviço</option>
          {(services ?? []).map((s) => (
            <option key={s.name as string} value={s.name as string}>
              Já fez: {s.name as string}
            </option>
          ))}
        </Select>
        <Select name="aniversario" defaultValue={filters.aniversario ?? ""} aria-label="Mês de aniversário">
          <option value="">Aniversário: qualquer mês</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              Aniversário em {m}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input type="checkbox" name="inativas" value="1" defaultChecked={filters.inativas === "1"} className="size-4 accent-[#b68d40]" />
          Sumidas (última visita há mais de 90 dias)
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-1">
          {filtered ? (
            <Button asChild variant="ghost">
              <Link href="/admin/emails">Limpar</Link>
            </Button>
          ) : null}
          <Button type="submit" data-testid="email-filtrar">
            <Filter /> Filtrar
          </Button>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink" data-testid="email-total">
          <b>{rows.length}</b> {rows.length === 1 ? "e-mail" : "e-mails"}
          {filtered ? ` (de ${all.length} no total)` : ""}
        </p>
        {rows.length ? (
          <div className="flex flex-wrap gap-2">
            <CopyButton value={rows.map((r) => r.email).join(", ")} label="Copiar e-mails" successMessage="E-mails copiados!" variant="outline" size="sm" />
            {canExport ? (
              <Button asChild size="sm" data-testid="email-exportar">
                <a href={`/admin/exportar/emails.csv${qs ? `?${qs}` : ""}`}>
                  <Download /> Baixar lista (CSV para o Resend)
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Mail />}
          title={filtered ? "Nenhum e-mail com esses filtros" : "Ainda não há e-mails na lista"}
          description="Os e-mails aparecem aqui quando a cliente marca “Aceito receber novidades” no agendamento ou se inscreve na caixa “Fique por dentro” do site."
        />
      ) : (
        <div className="card-premium divide-y divide-line/70 overflow-hidden" data-testid="email-lista">
          {rows.map((r) => (
            <div key={r.email} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-6" data-testid="email-row">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {r.clientId ? (
                    <Link href={`/admin/clientes/${r.clientId}`} className="hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    <span className="text-muted">Sem cadastro</span>
                  )}{" "}
                  <span className="font-normal text-ink/70">· {r.email}</span>
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {r.origins.map((o) => ORIGIN_LABEL[o]).join(" / ")} · {STATUS_LABEL[r.status]}
                  {r.lastVisit ? ` · última visita ${formatDate(r.lastVisit, tz)}` : ""} · desde {formatDate(r.since, tz)}
                </p>
              </div>
              <EmailRemoveButton email={r.email} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-3xl border border-line bg-white p-5 text-sm text-ink/80 sm:p-6">
        <p className="font-display text-lg text-ink">Como usar a lista numa campanha do Resend</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>Filtre o público aqui (ex.: aniversariantes do mês, quem já fez Axilas, sumidas há mais de 90 dias).</li>
          <li>Clique em “Baixar lista (CSV para o Resend)”.</li>
          <li>No Resend, abra a área de contatos e use a opção de importar contatos: envie o arquivo e coloque esses contatos em um segmento (ex.: “Aniversariantes de dezembro”).</li>
          <li>Crie a campanha (broadcast) escolhendo esse segmento.</li>
        </ol>
        <p className="mt-3 text-[13px] text-muted">
          Quem pedir para sair pelo link do e-mail fica descadastrado no Resend. Se alguém pedir para sair por outro canal, use o botão de remover ao lado do e-mail aqui.
        </p>
      </div>
    </>
  );
}
