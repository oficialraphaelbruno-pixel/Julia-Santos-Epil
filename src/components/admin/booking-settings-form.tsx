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
    },
  });
  const sw = (name: "onlineEnabled" | "autoConfirm" | "allowCancel" | "allowReschedule") => (
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
          } else toast.error(r.error);
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
