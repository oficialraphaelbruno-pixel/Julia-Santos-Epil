"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { saveBookingSettingsAction, type BookingSettingsInput } from "@/app/admin/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { BookingSettings } from "@/lib/types";
import { PIX_KEY_TYPE_LABEL, formatPixKey } from "@/lib/pix";

function Toggle({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-[15px] font-medium text-ink">{title}</span>
        <span className="block text-[13px] text-muted">{description}</span>
      </span>
      {children}
    </label>
  );
}

export function BookingSettingsForm({ settings, canEdit }: { settings: BookingSettings; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<BookingSettingsInput>({
    defaultValues: {
      onlineEnabled: settings.online_enabled,
      introText: settings.intro_text ?? "",
      autoConfirm: settings.auto_confirm,
      minAdvanceHours: settings.min_advance_minutes / 60,
      maxAdvanceDays: settings.max_advance_days,
      slotInterval: settings.slot_interval_minutes,
      allowCancel: settings.allow_client_cancel,
      cancelMinHours: settings.cancel_min_hours,
      allowReschedule: settings.allow_client_reschedule,
      rescheduleMinHours: settings.reschedule_min_hours,
      cancellationPolicy: settings.cancellation_policy ?? "",
      maxActive: settings.max_active_bookings_per_client,
      depositEnabled: settings.deposit_enabled,
      depositPercent: settings.deposit_percent,
      depositDeadlineHours: settings.deposit_deadline_hours,
      pixKeyType: (settings.pix_key_type ?? "telefone") as BookingSettingsInput["pixKeyType"],
      pixKey: settings.pix_key_type === "telefone" ? formatPixKey(settings.pix_key, "telefone") : (settings.pix_key ?? ""),
      pixHolder: settings.pix_holder_name ?? "",
      pixBank: settings.pix_bank ?? "",
      pixCity: settings.pix_city ?? "",
      depositInstructions: settings.deposit_instructions ?? "",
    },
  });
  const sw = (name: "onlineEnabled" | "autoConfirm" | "allowCancel" | "allowReschedule" | "depositEnabled") => (
    <Controller control={form.control} name={name} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} disabled={!canEdit} />} />
  );

  return (
    <form
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const r = await saveBookingSettingsAction(v);
          if (r.ok) {
            toast.success(r.message ?? "Salvo!");
            router.refresh();
          } else {
            toast.error(r.error);
            Object.entries(r.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof BookingSettingsInput, { message: m }));
          }
        }),
      )}
      className="space-y-6"
    >
      <div className="card-premium divide-y divide-line/70 px-5 sm:px-6">
        <Toggle title="Agendamento online ativo" description="Quando desativado, a página mostra o contato pelo WhatsApp.">
          {sw("onlineEnabled")}
        </Toggle>
        <Toggle title="Confirmação automática" description="Desligado: os agendamentos chegam como “Pendente” para você confirmar.">
          {sw("autoConfirm")}
        </Toggle>
        <Toggle title="Cliente pode cancelar pelo link" description="Respeitando o prazo mínimo abaixo.">
          {sw("allowCancel")}
        </Toggle>
        <Toggle title="Cliente pode reagendar pelo link" description="Respeitando o prazo mínimo abaixo.">
          {sw("allowReschedule")}
        </Toggle>
      </div>

      <div className="card-premium grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <Field label="Antecedência mínima para reservar (horas)" htmlFor="bs-min">
          <Input id="bs-min" type="number" min={0} max={336} step={0.5} disabled={!canEdit} {...form.register("minAdvanceHours")} />
        </Field>
        <Field label="Prazo máximo para agendar (dias à frente)" htmlFor="bs-max">
          <Input id="bs-max" type="number" min={1} max={365} disabled={!canEdit} {...form.register("maxAdvanceDays")} />
        </Field>
        <Field label="Cancelamento online até (horas antes)" htmlFor="bs-cancel">
          <Input id="bs-cancel" type="number" min={0} max={720} disabled={!canEdit} {...form.register("cancelMinHours")} />
        </Field>
        <Field label="Reagendamento online até (horas antes)" htmlFor="bs-resch">
          <Input id="bs-resch" type="number" min={0} max={720} disabled={!canEdit} {...form.register("rescheduleMinHours")} />
        </Field>
        <Field label="Intervalo entre horários exibidos" htmlFor="bs-step">
          <Select id="bs-step" disabled={!canEdit} {...form.register("slotInterval")}>
            {[5, 10, 15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                a cada {m} minutos
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Agendamentos ativos por cliente" htmlFor="bs-maxactive" hint="Evita reservas em excesso pelo mesmo WhatsApp.">
          <Input id="bs-maxactive" type="number" min={1} max={20} disabled={!canEdit} {...form.register("maxActive")} />
        </Field>
      </div>

      <div className="card-premium space-y-4 p-5 sm:p-6" data-testid="deposit-settings">
        <Toggle title="Cobrar sinal via Pix no agendamento online" description="O horário fica reservado (pendente) até você confirmar o recebimento do sinal.">
          {sw("depositEnabled")}
        </Toggle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Porcentagem do sinal (%)" htmlFor="bs-dp">
            <Input id="bs-dp" type="number" min={1} max={100} disabled={!canEdit} {...form.register("depositPercent")} />
          </Field>
          <Field label="Prazo para pagar o sinal (horas)" htmlFor="bs-dd">
            <Input id="bs-dd" type="number" min={1} max={168} disabled={!canEdit} {...form.register("depositDeadlineHours")} />
          </Field>
          <Field label="Tipo de chave Pix" htmlFor="bs-pt">
            <Select id="bs-pt" disabled={!canEdit} {...form.register("pixKeyType")}>
              {Object.entries(PIX_KEY_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chave Pix" htmlFor="bs-pk" error={form.formState.errors.pixKey?.message}>
            <Input id="bs-pk" disabled={!canEdit} {...form.register("pixKey")} />
          </Field>
          <Field label="Nome da favorecida (como aparece no banco)" htmlFor="bs-ph">
            <Input id="bs-ph" disabled={!canEdit} {...form.register("pixHolder")} />
          </Field>
          <Field label="Banco" htmlFor="bs-pb">
            <Input id="bs-pb" disabled={!canEdit} {...form.register("pixBank")} />
          </Field>
          <Field label="Cidade (usada no QR code Pix)" htmlFor="bs-pc" hint="Opcional. Ex.: Belo Horizonte">
            <Input id="bs-pc" disabled={!canEdit} {...form.register("pixCity")} />
          </Field>
        </div>
        <Field label="Instruções do sinal (exibidas à cliente)" htmlFor="bs-di" hint="Ex.: regras de devolução. Coloque as regras completas nos Termos de Uso.">
          <Textarea id="bs-di" rows={3} disabled={!canEdit} {...form.register("depositInstructions")} />
        </Field>
      </div>

      <div className="card-premium space-y-4 p-5 sm:p-6">
        <Field label="Texto de apresentação da página de agendamento" htmlFor="bs-intro">
          <Textarea id="bs-intro" rows={3} disabled={!canEdit} placeholder="Ex.: Escolha o serviço e o melhor horário para você." {...form.register("introText")} />
        </Field>
        <Field label="Política de cancelamento (exibida antes de confirmar)" htmlFor="bs-policy">
          <Textarea id="bs-policy" rows={4} disabled={!canEdit} {...form.register("cancellationPolicy")} />
        </Field>
      </div>

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Salvar configurações
          </Button>
        </div>
      ) : null}
    </form>
  );
}
