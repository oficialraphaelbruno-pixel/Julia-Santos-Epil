"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveClientAction, type ClientInput } from "@/app/admin/actions/clients";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { formatPhone } from "@/lib/phone";
import type { Client } from "@/lib/types";

export function ClientForm({
  client,
  onSaved,
  onCancel,
  compact,
}: {
  client?: Client | null;
  onSaved?: (c: { id: string; full_name: string; phone: string }) => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [existingId, setExistingId] = useState<string | null>(null);
  const form = useForm<ClientInput>({
    defaultValues: {
      id: client?.id ?? null,
      fullName: client?.full_name ?? "",
      phone: client ? formatPhone(client.phone) : "",
      email: client?.email ?? "",
      birthday: client?.birthday ?? "",
      notes: client?.notes ?? "",
      marketingConsent: client?.marketing_consent ?? false,
    },
  });
  const errors = form.formState.errors;

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          setExistingId(null);
          const res = await saveClientAction(values);
          if (res.ok && res.data) {
            toast.success(res.message ?? "Salvo!");
            router.refresh();
            onSaved?.(res.data);
          } else if (!res.ok) {
            toast.error(res.error);
            const fe = res.fieldErrors ?? {};
            if (fe._existingId) setExistingId(fe._existingId);
            Object.entries(fe).forEach(([k, m]) => k !== "_existingId" && form.setError(k as keyof ClientInput, { message: m }));
          }
        }),
      )}
    >
      <Field label="Nome completo *" htmlFor="cl-name" error={errors.fullName?.message}>
        <Input id="cl-name" autoComplete="off" {...form.register("fullName", { required: "Informe o nome" })} />
      </Field>
      <Field label="WhatsApp *" htmlFor="cl-phone" error={errors.phone?.message} hint="Com DDD">
        <Input id="cl-phone" type="tel" inputMode="tel" {...form.register("phone", { required: "Informe o WhatsApp" })} />
      </Field>
      {existingId ? (
        <p className="-mt-2 text-[13px]">
          <Link href={`/admin/clientes/${existingId}`} className="font-medium text-gold-dark underline">
            Abrir cadastro existente
          </Link>
        </p>
      ) : null}
      {!compact ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail" htmlFor="cl-email" error={errors.email?.message}>
              <Input id="cl-email" type="email" {...form.register("email")} />
            </Field>
            <Field label="Aniversário (opcional)" htmlFor="cl-bday">
              <Input id="cl-bday" type="date" {...form.register("birthday")} />
            </Field>
          </div>
          <Field
            label="Observações"
            htmlFor="cl-notes"
            error={errors.notes?.message}
            hint="Preferências e informações de atendimento. Evite registrar dados de saúde sem necessidade."
          >
            <Textarea id="cl-notes" rows={3} {...form.register("notes")} />
          </Field>
          <label className="flex items-start gap-3 rounded-2xl bg-ivory p-3 text-sm text-ink/80">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#b68d40]" {...form.register("marketingConsent")} />
            <span>A cliente autorizou receber novidades, promoções e cupons por e-mail e WhatsApp.</span>
          </label>
        </>
      ) : null}
      <div className="flex gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Salvar cliente
        </Button>
      </div>
    </form>
  );
}
