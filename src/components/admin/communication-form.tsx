"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { saveNotificationSettingsAction, type NotificationSettingsInput } from "@/app/admin/actions/integrations";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS, renderTemplate, type TemplateKey } from "@/lib/templates";

type Bools = Omit<NotificationSettingsInput, "emailReplyTo" | "templates">;

export function CommunicationForm({
  initial,
  canEdit,
  emailConfigured,
  whatsappConfigured,
  whatsappTested,
  businessName,
}: {
  initial: NotificationSettingsInput;
  canEdit: boolean;
  emailConfigured: boolean;
  whatsappConfigured: boolean;
  whatsappTested: boolean;
  businessName: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<NotificationSettingsInput>(initial);
  const [pending, start] = useTransition();
  const [active, setActive] = useState<TemplateKey>("confirmacao");
  const tpl = (k: TemplateKey) => v.templates?.[k] ?? DEFAULT_TEMPLATES[k];
  const set = (k: keyof Bools, val: boolean) => setV({ ...v, [k]: val });

  const row = ({ k, title, desc, disabled }: { k: keyof Bools; title: string; desc?: string; disabled?: boolean }) => (
    <label key={k} className="flex items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-[15px] text-ink">{title}</span>
        {desc ? <span className="block text-[12.5px] text-muted">{desc}</span> : null}
      </span>
      <Switch checked={Boolean(v[k])} onCheckedChange={(c) => set(k, c)} disabled={!canEdit || disabled} />
    </label>
  );

  return (
    <div className="space-y-6">
      <section className="card-premium px-5 sm:px-6">
        <div className="border-b border-line/70 py-4">
          <h2 className="font-display text-lg">E-mails automáticos</h2>
          <p className="text-[13px] text-muted">
            {emailConfigured ? "Servidor de e-mail configurado." : "Servidor de e-mail ainda não configurado: nada será enviado até a configuração."} Só clientes que
            informaram e-mail recebem.
          </p>
        </div>
        <div className="divide-y divide-line/70">
          {row({ k: "emailEnabled", title: "Enviar e-mails às clientes", })}
          {row({ k: "emailOnBooking", title: "Ao receber um agendamento", desc: "Inclui o link para a cliente gerenciar o horário.", })}
          {row({ k: "emailOnConfirm", title: "Ao confirmar", })}
          {row({ k: "emailOnReschedule", title: "Ao reagendar", })}
          {row({ k: "emailOnCancel", title: "Ao cancelar", })}
          {row({ k: "emailReminderDayBefore", title: "Lembrete na véspera", desc: "Enviado diariamente às 09:00 para os atendimentos do dia seguinte.", })}
          {row({ k: "emailReminder2h", title: "Lembrete 2 horas antes", desc: "Requer agendador de hora em hora (plano Pro da Vercel).", })}
        </div>
        <div className="py-4">
          <Field label="Responder para (e-mail do studio)" htmlFor="cm-reply">
            <Input id="cm-reply" type="email" disabled={!canEdit} value={v.emailReplyTo ?? ""} onChange={(e) => setV({ ...v, emailReplyTo: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="card-premium px-5 sm:px-6">
        <div className="border-b border-line/70 py-4">
          <h2 className="font-display text-lg">WhatsApp automático (API oficial)</h2>
          <p className="text-[13px] text-muted">
            {!whatsappConfigured
              ? "Não configurado. Os botões de WhatsApp do painel continuam funcionando no modo manual."
              : whatsappTested
                ? "Configurado e testado."
                : "Configurado, mas ainda sem envio de teste. Faça o teste em Integrações antes de ativar."}
          </p>
        </div>
        {row({ k: "whatsappApiEnabled", title: "Enviar confirmações e lembretes automaticamente", disabled: !whatsappConfigured || !whatsappTested, })}
      </section>

      <section className="card-premium p-5 sm:p-6">
        <h2 className="font-display text-lg">Modelos de mensagem</h2>
        <p className="mb-4 text-[13px] text-muted">
          Usados nos botões de WhatsApp e nos e-mails. Variáveis: <code>{"{nome}"}</code> <code>{"{servico}"}</code> <code>{"{data}"}</code>{" "}
          <code>{"{horario}"}</code> <code>{"{empresa}"}</code> <code>{"{link}"}</code>
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setActive(k)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] ${active === k ? "border-gold bg-ivory text-gold-deep" : "border-line text-ink/60"}`}
            >
              {TEMPLATE_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <Textarea
              rows={8}
              disabled={!canEdit}
              value={tpl(active)}
              onChange={(e) => setV({ ...v, templates: { ...v.templates, [active]: e.target.value } })}
              aria-label={`Modelo: ${TEMPLATE_LABELS[active]}`}
            />
            {canEdit && tpl(active) !== DEFAULT_TEMPLATES[active] ? (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-[13px] text-gold-dark underline"
                onClick={() => setV({ ...v, templates: { ...v.templates, [active]: DEFAULT_TEMPLATES[active] } })}
              >
                <RotateCcw className="size-3.5" /> Restaurar texto padrão
              </button>
            ) : null}
          </div>
          <div className="rounded-2xl bg-sand p-4">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-ink/50">Prévia</p>
            <div className="max-w-sm whitespace-pre-line rounded-2xl rounded-tl-sm bg-white p-3 text-[14px] leading-relaxed shadow-sm">
              {renderTemplate(
                active,
                { nome: "Maria Silva", servico: "Epilação", startsAt: new Date(Date.UTC(2026, 10, 14, 13, 0)).toISOString(), empresa: businessName, link: "https://…/agendamento/…" },
                { [active]: tpl(active) },
              )}
            </div>
          </div>
        </div>
      </section>

      {canEdit ? (
        <div className="flex justify-end">
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveNotificationSettingsAction(v);
                if (r.ok) {
                  toast.success(r.message ?? "Salvo!");
                  router.refresh();
                } else toast.error(r.error);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Salvar comunicação
          </Button>
        </div>
      ) : null}
    </div>
  );
}
