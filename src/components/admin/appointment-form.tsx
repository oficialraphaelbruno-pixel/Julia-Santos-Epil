"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import { adminSlotsAction, saveAppointmentAction } from "@/app/admin/actions/appointments";
import { searchClientsAction } from "@/app/admin/actions/clients";
import { ClientForm } from "@/components/admin/client-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { centsToInput, formatDuration, formatMoney, formatTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { STATUS_LABEL, type AppointmentStatus } from "@/lib/constants";
import type { Professional, Service } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ClientLite {
  id: string;
  full_name: string;
  phone: string;
}

export interface AppointmentFormValues {
  id?: string;
  serviceId: string;
  client: ClientLite | null;
  professionalId: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  price: string;
  notes: string;
}

export function AppointmentForm({
  initial,
  services,
  professionals,
  tz,
}: {
  initial: AppointmentFormValues;
  services: Service[];
  professionals: Professional[];
  tz: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<AppointmentFormValues>(initial);
  const [allowOutside, setAllowOutside] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const slotsKey = `${v.serviceId}|${v.date}`;
  const [loadedSlotsKey, setLoadedSlotsKey] = useState<string | null>(null);
  const loadingSlots = loadedSlotsKey !== slotsKey;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClientLite[]>([]);
  const [newClient, setNewClient] = useState(false);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const service = services.find((s) => s.id === v.serviceId);

  useEffect(() => {
    if (!v.serviceId || !v.date) return;
    let alive = true;
    const key = `${v.serviceId}|${v.date}`;
    adminSlotsAction(v.serviceId, v.date, v.id)
      .then((s) => alive && setSlots(s))
      .finally(() => alive && setLoadedSlotsKey(key));
    return () => {
      alive = false;
    };
  }, [v.serviceId, v.date, v.id]);

  useEffect(() => {
    if (v.client) return;
    const t = setTimeout(() => {
      searchClientsAction(q).then(setResults);
    }, 250);
    return () => clearTimeout(t);
  }, [q, v.client]);

  function submit() {
    setErrors({});
    if (!v.client) return setErrors({ clientId: "Escolha ou cadastre a cliente" });
    if (!v.serviceId) return setErrors({ serviceId: "Escolha o serviço" });
    if (!v.time) return setErrors({ time: "Escolha o horário" });
    start(async () => {
      const res = await saveAppointmentAction({
        id: v.id ?? null,
        serviceId: v.serviceId,
        clientId: v.client!.id,
        professionalId: v.professionalId,
        date: v.date,
        time: v.time,
        status: v.status,
        price: v.price,
        notes: v.notes,
        allowOutsideHours: allowOutside,
      });
      if (res.ok && res.data) {
        toast.success(res.message ?? "Salvo!");
        router.push(`/admin/agenda/${res.data.id}`);
        router.refresh();
      } else if (!res.ok) {
        toast.error(res.error);
        setErrors(res.fieldErrors ?? {});
        adminSlotsAction(v.serviceId, v.date, v.id).then(setSlots);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="card-premium space-y-5 p-5 sm:p-6">
        {/* Cliente */}
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink/80">Cliente *</p>
          {v.client ? (
            <div className="flex items-center justify-between rounded-xl border border-champagne/60 bg-ivory px-4 py-3">
              <div>
                <p className="font-medium text-ink">{v.client.full_name}</p>
                <p className="text-[13px] text-muted">{formatPhone(v.client.phone)}</p>
              </div>
              <button type="button" className="rounded-full p-1.5 text-muted hover:bg-white" onClick={() => setV({ ...v, client: null })} aria-label="Trocar cliente">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou WhatsApp" className="pl-11" aria-label="Buscar cliente" />
                </div>
                <Button type="button" variant="outline" className="h-11" onClick={() => setNewClient(true)}>
                  <UserPlus /> Nova
                </Button>
              </div>
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line">
                {results.length === 0 ? <li className="px-4 py-3 text-sm text-muted">Nenhuma cliente encontrada.</li> : null}
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-ivory"
                      onClick={() => setV({ ...v, client: c })}
                    >
                      <span className="font-medium">{c.full_name}</span>
                      <span className="text-muted">{formatPhone(c.phone)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {errors.clientId ? <p className="mt-1.5 text-[13px] text-rose-600">{errors.clientId}</p> : null}
        </div>

        {/* Serviço */}
        <Field label="Serviço *" htmlFor="ap-service" error={errors.serviceId}>
          <Select
            id="ap-service"
            value={v.serviceId}
            onChange={(e) => {
              const s = services.find((x) => x.id === e.target.value);
              setV({ ...v, serviceId: e.target.value, price: s ? centsToInput(s.price_cents) : v.price, time: "" });
            }}
          >
            <option value="">Selecione…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {formatMoney(s.price_cents)} · {formatDuration(s.duration_minutes)}
                {s.status !== "active" ? " (inativo)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        {professionals.length > 1 ? (
          <Field label="Profissional" htmlFor="ap-prof">
            <Select id="ap-prof" value={v.professionalId} onChange={(e) => setV({ ...v, professionalId: e.target.value })}>
              <option value="">Responsável pelo serviço</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Data *" htmlFor="ap-date">
            <Input id="ap-date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value, time: "" })} />
          </Field>
          <Field label="Horário *" htmlFor="ap-time" error={errors.time}>
            <Input id="ap-time" type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} />
          </Field>
        </div>

        {v.serviceId && v.date ? (
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink/80">Horários livres neste dia</p>
            {loadingSlots ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" /> Consultando…
              </p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted">Nenhum horário livre pelas regras de funcionamento. Use “encaixe” se necessário.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => {
                  const t = formatTime(s, tz);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setV({ ...v, time: t })}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm tabular-nums transition",
                        v.time === t ? "border-gold bg-gold text-white" : "border-line bg-white hover:border-champagne",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        <label className="flex items-start gap-3 rounded-2xl bg-ivory p-3 text-sm text-ink/80">
          <input type="checkbox" className="mt-0.5 size-4 accent-[#b68d40]" checked={allowOutside} onChange={(e) => setAllowOutside(e.target.checked)} />
          <span>
            <span className="font-medium text-ink">Encaixe</span> — permitir fora do expediente, almoço ou bloqueios. Nunca permite sobrepor outro atendimento.
          </span>
        </label>
      </div>

      <div className="card-premium h-fit space-y-5 p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Situação" htmlFor="ap-status">
            <Select id="ap-status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as AppointmentStatus })}>
              {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor (R$)" htmlFor="ap-price" error={errors.price}>
            <Input id="ap-price" inputMode="decimal" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} />
          </Field>
        </div>
        <Field label="Observação interna" htmlFor="ap-notes" hint="Visível somente para a equipe.">
          <Textarea id="ap-notes" rows={3} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </Field>
        {service ? (
          <div className="rounded-2xl bg-ivory p-4 text-sm">
            <p className="font-medium">{service.name}</p>
            <p className="text-muted">
              {formatDuration(service.duration_minutes)}
              {service.prep_minutes ? ` · ${service.prep_minutes} min de preparação` : ""}
              {service.buffer_after_minutes ? ` · ${service.buffer_after_minutes} min após` : ""}
            </p>
          </div>
        ) : null}
        <Button className="w-full" size="lg" disabled={pending} onClick={submit}>
          {pending ? <Loader2 className="animate-spin" /> : null} {v.id ? "Salvar alterações" : "Criar agendamento"}
        </Button>
      </div>

      <Dialog open={newClient} onOpenChange={setNewClient}>
        <DialogContent title="Nova cliente">
          <ClientForm
            compact
            onCancel={() => setNewClient(false)}
            onSaved={(c) => {
              setV((cur) => ({ ...cur, client: c }));
              setNewClient(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
