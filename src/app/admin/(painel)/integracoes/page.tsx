import type { Metadata } from "next";
import { CalendarSync, CheckCircle2, CircleAlert, CircleDashed, Mail, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { GoogleIntegrationControls } from "@/components/admin/google-integration";
import { TestSender } from "@/components/admin/test-sender";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { getConnectionStatus, googleConfig } from "@/lib/google-calendar";
import { emailConfig } from "@/lib/email";
import { whatsappCloudConfig } from "@/lib/whatsapp-cloud";
import { createServiceClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import { SITE_URL } from "@/lib/env";

export const metadata: Metadata = { title: "Integrações" };

const GOOGLE_MSG: Record<string, [string, boolean]> = {
  conectado: ["Google Agenda conectado! Escolha a agenda que deseja usar.", true],
  recusado: ["A autorização foi cancelada no Google.", false],
  "estado-invalido": ["Sessão de autorização expirada. Tente novamente.", false],
  "sem-token": ["O Google não enviou permissão de acesso contínuo. Remova o acesso em myaccount.google.com/permissions e conecte novamente.", false],
  erro: ["Não foi possível concluir a conexão com o Google.", false],
  "nao-configurado": ["As credenciais do Google ainda não foram configuradas no servidor.", false],
};

function Status({ state, text }: { state: "ok" | "warn" | "off"; text: string }) {
  const Icon = state === "ok" ? CheckCircle2 : state === "warn" ? CircleAlert : CircleDashed;
  const color = state === "ok" ? "text-emerald-700" : state === "warn" ? "text-amber-700" : "text-muted";
  return (
    <p className={`mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium ${color}`}>
      <Icon className="size-4" /> {text}
    </p>
  );
}

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  const ctx = await requireAdmin({ owner: true });
  const gcfg = googleConfig();
  const conn = await getConnectionStatus(ctx.business.id);
  const ecfg = emailConfig();
  const wcfg = whatsappCloudConfig();
  const db = createServiceClient();
  const { data: logs } = await db
    .from("sync_logs")
    .select("id, action, ok, message, created_at")
    .eq("business_id", ctx.business.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const msg = google ? GOOGLE_MSG[google] : null;
  const tz = ctx.business.timezone;

  return (
    <>
      <PageHeader title="Integrações" description="Conexões reais com serviços externos. Nada aqui é simulado." />
      {msg ? (
        <p className={`mb-5 rounded-2xl px-4 py-3 text-sm ${msg[1] ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{msg[0]}</p>
      ) : null}

      {/* GOOGLE AGENDA */}
      <section className="card-premium mb-6 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-cream text-gold">
            <CalendarSync className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl">Google Agenda</h2>
            {!gcfg.configured ? (
              <Status state="off" text={`Credenciais pendentes no servidor: ${gcfg.missing.join(", ")}`} />
            ) : !conn ? (
              <Status state="off" text="Não conectado" />
            ) : conn.status === "error" ? (
              <Status state="warn" text="Conectado com erro" />
            ) : (
              <Status state="ok" text={`Conectado${conn.google_email ? ` · ${conn.google_email}` : ""}`} />
            )}
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              Agendamentos <b>confirmados</b> viram eventos na agenda escolhida; reagendamentos atualizam o evento e cancelamentos o removem. Compromissos
              ocupados do Google bloqueiam os horários do agendamento online. Se o Google não responder, os horários são verificados apenas na agenda interna e as
              novas reservas ficam <b>pendentes</b> para sua confirmação. A sincronização é do studio para o Google (não importamos eventos como agendamentos).
            </p>

            {conn ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm">
                  Agenda em uso: <b className="font-medium">{conn.calendar_summary ?? conn.calendar_id}</b>
                  {conn.last_sync_at ? <span className="text-muted"> · última sincronização {formatDateTime(conn.last_sync_at, tz)}</span> : null}
                </p>
                {conn.last_error ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">Último erro: {conn.last_error}</p> : null}
                <GoogleIntegrationControls calendarId={conn.calendar_id} />
              </div>
            ) : gcfg.configured ? (
              <Button asChild className="mt-4">
                <a href="/api/integracoes/google/conectar">Conectar Google Agenda</a>
              </Button>
            ) : (
              <div className="mt-4 rounded-2xl bg-ivory p-4 text-[13px] text-ink/75">
                Para ativar: crie as credenciais OAuth no Google Cloud (guia em <code>docs/GOOGLE-AGENDA.md</code>) com o endereço de retorno{" "}
                <code className="break-all">{gcfg.redirectUri}</code> e configure as variáveis no servidor.
              </div>
            )}

            {logs?.length ? (
              <details className="mt-5">
                <summary className="cursor-pointer text-sm text-gold-dark">Registro de sincronização</summary>
                <ul className="mt-2 divide-y divide-line/70 text-[13px]">
                  {logs.map((l) => (
                    <li key={l.id} className="flex gap-3 py-2">
                      <span className={l.ok ? "text-emerald-700" : "text-rose-700"}>{l.ok ? "OK" : "Falha"}</span>
                      <span className="flex-1">
                        {l.action.replace("_", " ")}
                        {l.message ? ` — ${l.message}` : ""}
                      </span>
                      <span className="text-muted">{formatDateTime(l.created_at, tz)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
      </section>

      {/* E-MAIL */}
      <section className="card-premium mb-6 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-cream text-gold">
            <Mail className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl">E-mail transacional</h2>
            {ecfg.configured ? (
              <Status state="ok" text={`Servidor configurado · remetente ${ecfg.from}`} />
            ) : (
              <Status state="off" text={`Não configurado (faltam: ${ecfg.missing.join(", ")}) — nenhum e-mail é enviado`} />
            )}
            <p className="mt-3 text-[13px] text-muted">
              Confirmações, cancelamentos, reagendamentos e lembretes por e-mail, com sua logomarca. Enviados apenas para clientes que informaram e-mail. Ajuste o que é
              enviado em Comunicação.
            </p>
            {ecfg.configured ? (
              <div className="mt-4">
                <TestSender kind="email" defaultValue={ctx.email} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* WHATSAPP */}
      <section className="card-premium p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-cream text-gold">
            <MessageCircle className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl">WhatsApp</h2>
            <Status state="ok" text="Modo manual ativo (links wa.me com mensagens prontas)" />
            <div className="mt-3">
              {wcfg.configured ? (
                <Status state="ok" text="API oficial (WhatsApp Business Cloud) configurada no servidor" />
              ) : (
                <Status state="off" text="API oficial não configurada — envio automático indisponível" />
              )}
            </div>
            <p className="mt-3 text-[13px] text-muted">
              O envio automático usa somente a API oficial da Meta, com modelos de mensagem aprovados e respeitando o consentimento das clientes. Ele só pode ser ativado
              depois de um envio de teste real.
            </p>
            {wcfg.configured ? (
              <div className="mt-4">
                <TestSender kind="whatsapp" />
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <p className="mt-4 text-[12px] text-muted">Endereço do site configurado: {SITE_URL}</p>
    </>
  );
}
