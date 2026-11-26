"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { saveAssistantSettingsAction } from "@/app/admin/actions/assistant";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export interface AssistantSettingsRow {
  enabled: boolean;
  name: string;
  welcome_message: string;
  personality: string | null;
  extra_info: string | null;
  avoid_topics: string | null;
  daily_limit: number;
  model: string;
}

export function AssistantSettingsForm({
  settings,
  canEdit,
  isPlatformAdmin,
  keyConfigured,
}: {
  settings: AssistantSettingsRow;
  canEdit: boolean;
  isPlatformAdmin: boolean;
  keyConfigured: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [name, setName] = useState(settings.name);
  const [welcome, setWelcome] = useState(settings.welcome_message);
  const [personality, setPersonality] = useState(settings.personality ?? "");
  const [extra, setExtra] = useState(settings.extra_info ?? "");
  const [avoid, setAvoid] = useState(settings.avoid_topics ?? "");
  const [limit, setLimit] = useState(String(settings.daily_limit));
  const [model, setModel] = useState(settings.model);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const live = enabled && keyConfigured;

  return (
    <form
      className="card-premium space-y-5 p-5 sm:p-6"
      data-testid="assistant-settings"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveAssistantSettingsAction({
            enabled,
            name,
            welcomeMessage: welcome,
            personality,
            extraInfo: extra,
            avoidTopics: avoid,
            dailyLimit: Number(limit),
            model: isPlatformAdmin ? model : undefined,
          });
          if (r.ok) {
            setErrors({});
            toast.success(r.message ?? "Salvo.");
            router.refresh();
          } else {
            setErrors(r.fieldErrors ?? {});
            toast.error(r.error);
          }
        });
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-20 shrink-0 place-items-center rounded-full bg-cream ring-2 ring-champagne/60">
          <Image src="/brand/mel-avatar.webp" alt="Avatar da assistente" width={80} height={80} className="size-[72px] object-contain" />
        </span>
        <div className="flex-1">
          <p className="font-display text-xl text-ink">{name || "Assistente"}</p>
          <p className="mt-1 text-[13px]" data-testid="assistant-status">
            {live ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="size-4" /> No ar: aparece no canto do site
              </span>
            ) : !keyConfigured ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700">
                <AlertTriangle className="size-4" /> Falta a chave da OpenAI na Vercel (OPENAI_API_KEY). Enquanto isso, ela não aparece no site.
              </span>
            ) : (
              <span className="text-muted">Desligada: não aparece no site.</span>
            )}
          </p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-4">
        <span>
          <span className="block font-medium text-ink">Assistente ligada</span>
          <span className="text-[13px] text-muted">Mostra o balãozinho com o avatar no canto do site (página inicial e Dúvidas).</span>
        </span>
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!canEdit} aria-label="Assistente ligada" data-testid="assistant-enabled" />
      </label>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <Field label="Nome" htmlFor="as-name" error={errors.name}>
          <Input id="as-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={30} />
        </Field>
        <Field label="Limite de mensagens por dia" htmlFor="as-limit" error={errors.dailyLimit} hint="Protege o seu crédito da OpenAI.">
          <Input id="as-limit" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} disabled={!canEdit} />
        </Field>
      </div>

      <Field label="Mensagem de boas-vindas" htmlFor="as-welcome" error={errors.welcomeMessage}>
        <Textarea id="as-welcome" rows={3} value={welcome} onChange={(e) => setWelcome(e.target.value)} disabled={!canEdit} maxLength={600} />
      </Field>

      <Field
        label="Jeito de falar (opcional)"
        htmlFor="as-personality"
        error={errors.personality}
        hint="Ex.: “Chame as clientes de flor”, “Use poucos emojis”. Ela já fala de um jeito feminino e acolhedor."
      >
        <Textarea id="as-personality" rows={3} value={personality} onChange={(e) => setPersonality(e.target.value)} disabled={!canEdit} maxLength={1500} />
      </Field>

      <Field
        label="Informações extras que ela pode usar (opcional)"
        htmlFor="as-extra"
        error={errors.extraInfo}
        hint="Ex.: formas de pagamento no dia do atendimento, estacionamento, se atende menores com responsável. Ela só fala o que estiver aqui, nos serviços, nas regras do agendamento e no FAQ."
      >
        <Textarea id="as-extra" rows={5} value={extra} onChange={(e) => setExtra(e.target.value)} disabled={!canEdit} maxLength={4000} data-testid="assistant-extra" />
      </Field>

      <Field
        label="Assuntos que ela deve evitar (opcional)"
        htmlFor="as-avoid"
        error={errors.avoidTopics}
        hint="Ela encaminha para o WhatsApp. Questões de saúde já são sempre encaminhadas."
      >
        <Textarea id="as-avoid" rows={2} value={avoid} onChange={(e) => setAvoid(e.target.value)} disabled={!canEdit} maxLength={1500} />
      </Field>

      {isPlatformAdmin ? (
        <Field label="Modelo da OpenAI (só o administrador geral vê)" htmlFor="as-model" error={errors.model} hint="Use um modelo “mini”, que é rápido e barato.">
          <Input id="as-model" value={model} onChange={(e) => setModel(e.target.value)} disabled={!canEdit} className="max-w-60 font-mono" />
        </Field>
      ) : null}

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending} data-testid="salvar-assistente">
            {pending ? <Loader2 className="animate-spin" /> : null} Salvar assistente
          </Button>
        </div>
      ) : null}
    </form>
  );
}
