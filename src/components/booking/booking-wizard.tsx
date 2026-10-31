"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock,
  Download,
  Link2,
  Loader2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { BookingCalendar } from "@/components/booking/booking-calendar";
import { SlotPicker } from "@/components/booking/slot-picker";
import { BrandLogo } from "@/components/site/brand-logo";
import { WhatsAppIcon } from "@/components/site/icons";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import {
  createBookingAction,
  getAvailableDaysAction,
  getAvailableSlotsAction,
  type BookingCreated,
  type Slot,
} from "@/app/agendar/actions";
import { clientBookingSchema, type ClientBookingInput } from "@/lib/schemas";
import { formatDuration, formatLongDate, formatMoney, formatTime, formatDate } from "@/lib/format";
import { googleCalendarTemplateLink } from "@/lib/ics";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { PublicBusiness, PublicService, PublicSettings } from "@/lib/public-data";
import type { Category } from "@/lib/types";

const STEPS = ["Serviço", "Data", "Horário", "Seus dados", "Revisão"];

interface Props {
  business: PublicBusiness;
  services: PublicService[];
  categories: Category[];
  settings: PublicSettings;
  professionalName: string | null;
  todayKey: string;
  maxKey: string;
  initialServiceId?: string;
  siteUrl: string;
}

export function BookingWizard(props: Props) {
  const { business, services, categories, settings, professionalName, todayKey, maxKey, siteUrl } = props;
  const tz = business.timezone;
  const initial = services.find((s) => s.id === props.initialServiceId);

  const [step, setStep] = useState(initial ? 1 : 0);
  const [service, setService] = useState<PublicService | null>(initial ?? null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<BookingCreated | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<ClientBookingInput>({
    resolver: zodResolver(clientBookingSchema),
    defaultValues: { fullName: "", phone: "", email: "", message: "", marketing: false, website: "" },
    mode: "onTouched",
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, result]);

  const loadDays = useCallback(
    (from: string, to: string) => (service ? getAvailableDaysAction(business.slug, service.id, from, to) : Promise.resolve([])),
    [business.slug, service],
  );

  const loadSlots = useCallback(
    async (d: string) => {
      if (!service) return;
      setSlotsLoading(true);
      try {
        setSlots(await getAvailableSlotsAction(business.slug, service.id, d));
      } finally {
        setSlotsLoading(false);
      }
    },
    [business.slug, service],
  );

  const servicesByCategory = useMemo(() => {
    const groups = categories
      .map((c) => ({ name: c.name, items: services.filter((s) => s.category_id === c.id) }))
      .filter((g) => g.items.length);
    const rest = services.filter((s) => !s.category_id || !categories.some((c) => c.id === s.category_id));
    if (rest.length) groups.push({ name: groups.length ? "Outros serviços" : "", items: rest });
    return groups;
  }, [services, categories]);

  function submit() {
    if (!service || !slot) return;
    setNotice(null);
    startTransition(async () => {
      const res = await createBookingAction({
        slug: business.slug,
        serviceId: service.id,
        startsAt: slot.start,
        client: form.getValues(),
      });
      if (res.ok && res.data) {
        setResult(res.data);
        return;
      }
      if (!res.ok) {
        if (res.fieldErrors?._code === "HORARIO_INDISPONIVEL") {
          setNotice("Que pena! Esse horário acabou de ser reservado. Veja abaixo outros horários disponíveis nesse dia.");
          setSlot(null);
          setStep(2);
          if (day) await loadSlots(day);
          return;
        }
        if (res.fieldErrors) {
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            if (k !== "_code") form.setError(k as keyof ClientBookingInput, { message: v });
          }
          if (Object.keys(res.fieldErrors).some((k) => k !== "_code")) setStep(3);
        }
        setNotice(res.error);
      }
    });
  }

  // ======================= CONFIRMAÇÃO =======================
  if (result && service && slot) {
    const manageUrl = `${siteUrl}/agendamento/${result.token}`;
    const event = {
      uid: result.reference,
      title: `${service.name} — ${business.name}`,
      description: `Referência: ${result.reference}\nGerenciar: ${manageUrl}`,
      startsAt: slot.start,
      endsAt: slot.end,
    };
    const waMsg = `Olá! Acabei de agendar pelo site ✨\nReferência: ${result.reference}\nServiço: ${service.name}\nData: ${formatDate(slot.start, tz)} às ${formatTime(slot.start, tz)}`;
    return (
      <div className="animate-fade-up mx-auto max-w-xl text-center">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-[linear-gradient(135deg,#c9a35f,#92702e)] text-white shadow-lift">
          <Check className="size-9" strokeWidth={2.4} />
        </div>
        <h1 className="mt-7 text-3xl text-ink sm:text-4xl">Agendamento realizado com sucesso! ✨</h1>
        <p className="mt-3 text-muted">
          {result.status === "confirmed"
            ? "Seu horário está confirmado. Esperamos por você!"
            : "Seu pedido foi registrado e aguarda a confirmação do studio. Você será avisada pelo WhatsApp."}
        </p>

        <div className="mt-8 rounded-3xl border border-line bg-white p-6 text-left shadow-soft">
          <div className="flex items-center justify-between border-b border-line/70 pb-4">
            <span className="text-xs uppercase tracking-[0.2em] text-muted">Número de referência</span>
            <span className="font-mono text-lg font-semibold tracking-wider text-gold-dark" data-testid="booking-reference">
              {result.reference}
            </span>
          </div>
          <Summary service={service} slot={slot} tz={tz} professionalName={professionalName} />
        </div>

        <div className="mt-6 rounded-3xl border border-champagne/40 bg-ivory p-5 text-left">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <Link2 className="size-4 text-gold" /> Seu link para gerenciar o agendamento
          </p>
          <p className="mt-1 text-[13px] text-muted">Guarde este link: por ele você pode consultar, cancelar ou reagendar conforme as regras do studio.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href={`/agendamento/${result.token}`} data-testid="manage-link">
                Abrir meu agendamento
              </Link>
            </Button>
            <CopyButton value={manageUrl} variant="soft" size="sm" className="flex-1" label="Copiar link" />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline">
            <a href={googleCalendarTemplateLink(event)} target="_blank" rel="noopener noreferrer">
              <CalendarPlus /> Google Agenda
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/agendamento/${result.token}/ics`}>
              <Download /> Apple / Outlook (.ics)
            </a>
          </Button>
        </div>
        {business.whatsapp_phone ? (
          <Button asChild variant="whatsapp" className="mt-3 w-full">
            <a href={whatsappLink(business.whatsapp_phone, waMsg)} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> Falar com o studio pelo WhatsApp
            </a>
          </Button>
        ) : null}
        <Link href="/" className="mt-8 inline-block text-sm text-gold-dark underline-offset-4 hover:underline">
          Voltar ao site
        </Link>
      </div>
    );
  }

  // ======================= ETAPAS =======================
  return (
    <div className="mx-auto max-w-2xl">
      <Progress step={step} />

      {notice ? (
        <div role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notice}
        </div>
      ) : null}

      {step > 0 ? (
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setStep(step - 1);
          }}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-gold-dark hover:underline"
        >
          <ArrowLeft className="size-4" /> Voltar
        </button>
      ) : null}

      {/* ETAPA 1 — SERVIÇO */}
      {step === 0 ? (
        <section className="animate-fade-up">
          <StepTitle icon={<Sparkles />} title="Escolha o serviço" />
          {services.length === 0 ? (
            <p className="rounded-3xl border border-line bg-white p-8 text-center text-muted">
              Nenhum serviço disponível para agendamento online no momento.
            </p>
          ) : (
            <div className="space-y-8">
              {servicesByCategory.map((g) => (
                <div key={g.name || "todos"}>
                  {g.name ? <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">{g.name}</p> : null}
                  <div className="space-y-3">
                    {g.items.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setService(s);
                          setDay(null);
                          setSlot(null);
                          setStep(1);
                        }}
                        className={cn(
                          "group flex w-full items-center gap-4 rounded-3xl border bg-white p-5 text-left shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-champagne hover:shadow-lift",
                          service?.id === s.id ? "border-gold" : "border-line",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-lg leading-snug text-ink">{s.name}</p>
                          {s.description ? <p className="mt-1 line-clamp-2 text-sm text-muted">{s.description}</p> : null}
                          <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted">
                            <Clock className="size-3.5 text-gold" /> {formatDuration(s.duration_minutes)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-xl text-gold-dark">{formatMoney(s.price_cents)}</p>
                          <span className="mt-2 inline-block text-xs font-medium uppercase tracking-wider text-gold opacity-80 transition group-hover:opacity-100">
                            Escolher →
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* ETAPA 2 — DATA */}
      {step === 1 && service ? (
        <section className="animate-fade-up">
          <StepTitle icon={<CalendarDays />} title="Escolha a data" subtitle={service.name} />
          <BookingCalendar
            todayKey={todayKey}
            maxKey={maxKey}
            selected={day}
            loadDays={loadDays}
            onSelect={(d) => {
              setDay(d);
              setSlot(null);
              setNotice(null);
              setStep(2);
              void loadSlots(d);
            }}
          />
        </section>
      ) : null}

      {/* ETAPA 3 — HORÁRIO */}
      {step === 2 && service && day ? (
        <section className="animate-fade-up">
          <StepTitle icon={<Clock />} title="Escolha o horário" subtitle={formatLongDate(`${day}T12:00:00Z`, "UTC")} />
          <div className="rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-6">
            <SlotPicker
              slots={slots}
              loading={slotsLoading}
              selected={slot?.start ?? null}
              tz={tz}
              onSelect={(s) => {
                setSlot(s);
                setNotice(null);
                setStep(3);
              }}
            />
          </div>
        </section>
      ) : null}

      {/* ETAPA 4 — DADOS */}
      {step === 3 && service && slot ? (
        <section className="animate-fade-up">
          <StepTitle icon={<UserRound />} title="Seus dados" subtitle="Usamos apenas para confirmar e lembrar seu atendimento." />
          <form
            noValidate
            onSubmit={form.handleSubmit(() => {
              setNotice(null);
              setStep(4);
            })}
            className="space-y-5 rounded-3xl border border-line bg-white p-5 shadow-soft sm:p-7"
          >
            <Field label="Nome completo *" htmlFor="fullName" error={form.formState.errors.fullName?.message}>
              <Input id="fullName" autoComplete="name" aria-invalid={!!form.formState.errors.fullName} {...form.register("fullName")} />
            </Field>
            <Field label="WhatsApp *" htmlFor="phone" error={form.formState.errors.phone?.message} hint="Com DDD. Ex.: (31) 99999-9999">
              <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={!!form.formState.errors.phone} {...form.register("phone")} />
            </Field>
            <Field label="E-mail (opcional)" htmlFor="email" error={form.formState.errors.email?.message}>
              <Input id="email" type="email" inputMode="email" autoComplete="email" {...form.register("email")} />
            </Field>
            <Field label="Observação (opcional)" htmlFor="message" error={form.formState.errors.message?.message}>
              <Textarea id="message" rows={3} placeholder="Alguma informação para o studio?" {...form.register("message")} />
            </Field>
            {/* honeypot: invisível para pessoas */}
            <input type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden {...form.register("website")} />

            <div className="space-y-3 rounded-2xl bg-ivory p-4">
              <label className="flex items-start gap-3 text-sm leading-relaxed text-ink/80">
                <input type="checkbox" className="mt-1 size-4 accent-[#b68d40]" {...form.register("privacy")} />
                <span>
                  Li e concordo com a{" "}
                  <Link href="/privacidade" target="_blank" className="font-medium text-gold-dark underline underline-offset-2">
                    Política de Privacidade
                  </Link>
                  . Autorizo o uso dos meus dados para agendar e gerenciar meu atendimento. *
                </span>
              </label>
              {form.formState.errors.privacy ? <p className="text-[13px] text-rose-600">{form.formState.errors.privacy.message}</p> : null}
              <label className="flex items-start gap-3 text-sm leading-relaxed text-ink/80">
                <input type="checkbox" className="mt-1 size-4 accent-[#b68d40]" {...form.register("marketing")} />
                <span>Aceito receber novidades e mensagens de relacionamento pelo WhatsApp (opcional, pode ser revogado a qualquer momento).</span>
              </label>
            </div>
            <Button type="submit" size="lg" className="w-full">
              Revisar agendamento
            </Button>
          </form>
        </section>
      ) : null}

      {/* ETAPA 5 — REVISÃO */}
      {step === 4 && service && slot ? (
        <section className="animate-fade-up">
          <StepTitle icon={<Check />} title="Revise seu agendamento" />
          <div className="rounded-3xl border border-line bg-white p-6 shadow-soft">
            <Summary service={service} slot={slot} tz={tz} professionalName={professionalName} />
            <div className="mt-5 border-t border-line/70 pt-5 text-sm">
              <p className="text-muted">Cliente</p>
              <p className="mt-1 font-medium text-ink">{form.getValues("fullName")}</p>
              <p className="text-ink/70">{form.getValues("phone")}</p>
              {form.getValues("email") ? <p className="text-ink/70">{form.getValues("email")}</p> : null}
            </div>
            {settings.cancellation_policy ? (
              <div className="mt-5 rounded-2xl bg-ivory p-4 text-[13px] leading-relaxed text-ink/75">
                <p className="mb-1 font-medium text-ink">Política de cancelamento</p>
                <p className="whitespace-pre-line">{settings.cancellation_policy}</p>
              </div>
            ) : null}
            {!settings.auto_confirm ? (
              <p className="mt-5 text-[13px] text-muted">Seu horário ficará reservado e o studio confirmará o atendimento.</p>
            ) : null}
            <Button type="button" size="lg" className="mt-6 w-full" disabled={pending} onClick={submit} data-testid="confirm-booking">
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              {pending ? "Reservando…" : "Confirmar agendamento"}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Summary({
  service,
  slot,
  tz,
  professionalName,
}: {
  service: PublicService;
  slot: Slot;
  tz: string;
  professionalName: string | null;
}) {
  const rows = [
    ["Serviço", service.name],
    ["Data", `${formatDate(slot.start, tz)} (${formatLongDate(slot.start, tz).split(",")[0]})`],
    ["Horário", `${formatTime(slot.start, tz)} às ${formatTime(slot.end, tz)}`],
    ["Duração", formatDuration(service.duration_minutes)],
    ["Valor", formatMoney(service.price_cents)],
    ...(professionalName ? [["Profissional", professionalName]] : []),
  ];
  return (
    <dl className="mt-4 space-y-3 text-[15px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function StepTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-gold shadow-soft [&_svg]:size-5">{icon}</span>
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm first-letter:uppercase text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <ol className="mb-8 flex items-center gap-1.5" aria-label="Etapas do agendamento">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 flex-col gap-2">
          <span
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              i < step ? "bg-gold" : i === step ? "bg-[linear-gradient(90deg,#b68d40,#ebe1d1)]" : "bg-sand",
            )}
          />
          <span className={cn("hidden text-[11px] uppercase tracking-wider sm:block", i <= step ? "text-gold-dark" : "text-muted/60")}>
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function BookingShell({ business, children }: { business: PublicBusiness; children: React.ReactNode }) {
  return (
    <div className="grain min-h-dvh">
      <header className="border-b border-line/60 bg-ivory/80 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-2xl items-center justify-between px-5">
          <Link href="/" aria-label={`${business.name} — início`}>
            <BrandLogo src={business.logo_url} name={business.name} className="h-12 w-[78px]" priority />
          </Link>
          {business.whatsapp_phone ? (
            <a
              href={whatsappLink(business.whatsapp_phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink/80 transition hover:border-champagne"
            >
              <WhatsAppIcon className="size-4 text-[#1f9d55]" /> Dúvidas?
            </a>
          ) : null}
        </div>
      </header>
      {business.cover_url ? (
        <div className="relative mx-auto mt-4 aspect-[16/6] max-w-2xl overflow-hidden rounded-3xl px-5 sm:mt-6">
          <div className="relative h-full overflow-hidden rounded-3xl shadow-soft">
            <Image src={business.cover_url} alt="" fill priority sizes="(min-width: 672px) 672px, 100vw" className="object-cover" />
          </div>
        </div>
      ) : null}
      <main className="px-5 pb-20 pt-8 sm:pt-12">{children}</main>
    </div>
  );
}
