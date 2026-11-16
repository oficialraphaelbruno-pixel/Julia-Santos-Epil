"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Loader2, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { deleteOfferAction, saveOfferAction, setOfferActiveAction } from "@/app/admin/actions/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { centsToInput, formatDuration, formatMoney, parseMoneyToCents } from "@/lib/format";
import type { ServiceOffer } from "@/lib/types";

interface Svc {
  id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  status: string;
}

/** Ofertas (order bump): serviço extra com preço especial para quem agenda o serviço principal. */
export function OffersManager({ offers, services, canEdit }: { offers: ServiceOffer[]; services: Svc[]; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ServiceOffer | null | undefined>(undefined);
  const [pending, start] = useTransition();
  const byId = new Map(services.map((s) => [s.id, s]));
  const active = services.filter((s) => s.status === "active");

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Feito.");
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <section className="mt-10" data-testid="offers-manager">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl text-ink">
            <Gift className="size-5 text-gold" /> Ofertas no agendamento (order bump)
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Ofereça um serviço extra com desconto para quem agenda outro serviço. Ex.: quem agenda <b>Nariz</b> vê a oferta de
            adicionar <b>Buço</b> por um preço especial, no mesmo horário.
          </p>
        </div>
        {canEdit ? (
          <Button onClick={() => setEditing(null)} data-testid="nova-oferta">
            <Plus /> Nova oferta
          </Button>
        ) : null}
      </div>

      {offers.length === 0 ? (
        <EmptyState icon={<Gift />} title="Nenhuma oferta criada" description="Crie a primeira oferta para aumentar o valor de cada atendimento." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {offers.map((o) => {
            const main = byId.get(o.service_id);
            const extra = byId.get(o.offer_service_id);
            const save = (extra?.price_cents ?? 0) - o.offer_price_cents;
            return (
              <div key={o.id} className="card-premium p-5" data-testid={`oferta-${extra?.name ?? o.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] uppercase tracking-wider text-muted">Quem agenda</p>
                    <p className="font-medium text-ink">{main?.name ?? "Serviço removido"}</p>
                    <p className="mt-2 text-[12px] uppercase tracking-wider text-muted">vê a oferta</p>
                    <p className="font-medium text-ink">{extra?.name ?? "Serviço removido"}</p>
                  </div>
                  <Badge className={o.active ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-zinc-100 text-zinc-600 ring-zinc-200"}>
                    {o.active ? "Ativa" : "Pausada"}
                  </Badge>
                </div>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  {extra && save > 0 ? <span className="text-sm text-muted line-through">{formatMoney(extra.price_cents)}</span> : null}
                  <span className="font-display text-xl text-gold-dark">+ {formatMoney(o.offer_price_cents)}</span>
                  {save > 0 ? <span className="text-[13px] text-emerald-700">economia de {formatMoney(save)}</span> : null}
                </p>
                {extra ? <p className="text-[13px] text-muted">+{formatDuration(extra.duration_minutes)} no mesmo horário</p> : null}
                {o.headline ? <p className="mt-2 text-[13px] italic text-ink/70">&ldquo;{o.headline}&rdquo;</p> : null}
                {canEdit ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="soft" onClick={() => setEditing(o)}>
                      <Pencil /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setOfferActiveAction(o.id, !o.active))}>
                      {o.active ? <PowerOff /> : <Power />} {o.active ? "Pausar" : "Ativar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => confirm("Remover esta oferta?") && run(() => deleteOfferAction(o.id))}
                    >
                      <Trash2 /> Remover
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(v) => !v && setEditing(undefined)}>
        <DialogContent title={editing ? "Editar oferta" : "Nova oferta"} description="O serviço extra é feito no mesmo horário, logo após o principal.">
          {editing !== undefined ? <OfferForm offer={editing} services={active} onDone={() => setEditing(undefined)} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function OfferForm({ offer, services, onDone }: { offer: ServiceOffer | null; services: Svc[]; onDone: () => void }) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(offer?.service_id ?? "");
  const [offerServiceId, setOfferServiceId] = useState(offer?.offer_service_id ?? "");
  const [price, setPrice] = useState(offer ? centsToInput(offer.offer_price_cents) : "");
  const [headline, setHeadline] = useState(offer?.headline ?? "");
  const [active, setActive] = useState(offer?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const extra = services.find((s) => s.id === offerServiceId);
  const cents = parseMoneyToCents(price);

  return (
    <form
      className="space-y-4 overflow-y-auto px-6 py-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveOfferAction({ id: offer?.id ?? null, serviceId, offerServiceId, price, headline, active });
          if (r.ok) {
            toast.success(r.message ?? "Salvo.");
            router.refresh();
            onDone();
          } else {
            setErrors(r.fieldErrors ?? {});
            toast.error(r.error);
          }
        });
      }}
    >
      <Field label="Quem agendar este serviço…" htmlFor="of-main" error={errors.serviceId}>
        <Select id="of-main" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Escolha o serviço principal</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatMoney(s.price_cents)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="…verá a oferta de adicionar" htmlFor="of-extra" error={errors.offerServiceId}>
        <Select id="of-extra" value={offerServiceId} onChange={(e) => setOfferServiceId(e.target.value)}>
          <option value="">Escolha o serviço oferecido</option>
          {services
            .filter((s) => s.id !== serviceId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {formatMoney(s.price_cents)} ({formatDuration(s.duration_minutes)})
              </option>
            ))}
        </Select>
      </Field>
      <Field
        label="Preço especial da oferta (R$)"
        htmlFor="of-price"
        error={errors.price}
        hint={
          extra && cents !== null
            ? cents < extra.price_cents
              ? `Preço normal ${formatMoney(extra.price_cents)} · a cliente economiza ${formatMoney(extra.price_cents - cents)}`
              : `Preço normal ${formatMoney(extra.price_cents)}`
            : "Ex.: 15,00"
        }
      >
        <Input id="of-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
      </Field>
      <Field label="Frase da oferta (opcional)" htmlFor="of-headline" error={errors.headline} hint='Se ficar em branco: "Aproveite e faça também [serviço]".'>
        <Input id="of-headline" value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} placeholder="Ex.: Combine com buço e saia lisinha!" />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-4 text-sm">
        <span>Oferta ativa no site</span>
        <Switch checked={active} onCheckedChange={setActive} />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending} data-testid="salvar-oferta">
          {pending ? <Loader2 className="animate-spin" /> : null} Salvar oferta
        </Button>
      </div>
    </form>
  );
}
