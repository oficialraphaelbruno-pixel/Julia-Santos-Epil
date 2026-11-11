"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Link2, Loader2, Pencil, Plus, Power, PowerOff, TicketPercent, Trash2 } from "lucide-react";
import { deleteCouponAction, saveCouponAction, setCouponActiveAction, type CouponInput } from "@/app/admin/actions/coupons";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { centsToInput, formatDateKey, formatMoney } from "@/lib/format";

export interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses: number | null;
  once_per_client: boolean;
  min_price_cents: number;
  valid_from: string | null;
  valid_until: string | null;
  service_ids: string[] | null;
  active: boolean;
  uses: number;
  discount_total_cents: number;
}

function discountLabel(c: Pick<CouponRow, "discount_type" | "discount_value">) {
  return c.discount_type === "percent" ? `${c.discount_value}% de desconto` : `${formatMoney(c.discount_value)} de desconto`;
}

export function CouponsManager({
  coupons,
  services,
  today,
  canEdit,
  siteUrl,
}: {
  coupons: CouponRow[];
  services: { id: string; name: string }[];
  today: string;
  canEdit: boolean;
  siteUrl: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CouponRow | null | undefined>(undefined);
  const [pending, start] = useTransition();

  const statusOf = (c: CouponRow) => {
    if (!c.active) return ["Inativo", "bg-zinc-100 text-zinc-600 ring-zinc-200"];
    if (c.valid_until && c.valid_until < today) return ["Vencido", "bg-rose-50 text-rose-700 ring-rose-200"];
    if (c.valid_from && c.valid_from > today) return ["Agendado", "bg-sky-50 text-sky-800 ring-sky-200"];
    if (c.max_uses !== null && c.uses >= c.max_uses) return ["Esgotado", "bg-amber-50 text-amber-800 ring-amber-200"];
    return ["Ativo", "bg-emerald-50 text-emerald-800 ring-emerald-200"];
  };
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Feito.");
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <>
      {canEdit ? (
        <Button className="mb-5" onClick={() => setEditing(null)} data-testid="novo-cupom">
          <Plus /> Novo cupom
        </Button>
      ) : null}

      {coupons.length === 0 ? (
        <EmptyState
          icon={<TicketPercent />}
          title="Nenhum cupom criado"
          description="Crie cupons com nome personalizado (ex.: BEMVINDA10) para as clientes usarem no agendamento online."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {coupons.map((c) => {
            const [label, style] = statusOf(c);
            return (
              <div key={c.id} className="card-premium p-5" data-testid={`cupom-${c.code}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-semibold tracking-wider text-gold-deep">{c.code}</p>
                    <p className="text-sm text-ink">{discountLabel(c)}</p>
                    {c.description ? <p className="mt-1 text-[13px] text-muted">{c.description}</p> : null}
                  </div>
                  <Badge className={style}>{label}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
                  <div>
                    <dt className="text-muted">Usos</dt>
                    <dd className="font-medium" data-testid="cupom-usos">
                      {c.uses}
                      {c.max_uses !== null ? ` de ${c.max_uses}` : " (ilimitado)"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Desconto concedido</dt>
                    <dd className="font-medium">{formatMoney(c.discount_total_cents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Validade</dt>
                    <dd>
                      {c.valid_from || c.valid_until
                        ? `${c.valid_from ? formatDateKey(c.valid_from) : "—"} até ${c.valid_until ? formatDateKey(c.valid_until) : "sem fim"}`
                        : "Sem prazo"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Regras</dt>
                    <dd>
                      {c.once_per_client ? "1 uso por cliente" : "Uso livre por cliente"}
                      {c.min_price_cents ? ` · mín. ${formatMoney(c.min_price_cents)}` : ""}
                      {c.service_ids?.length ? ` · ${c.service_ids.length} serviço(s)` : " · todos os serviços"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 rounded-xl border border-dashed border-champagne/70 bg-ivory/60 p-3" data-testid="cupom-link">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink/70">
                    <Link2 className="size-3.5 text-gold" /> Link do cupom (para clientes e anúncios)
                  </p>
                  <p className="mt-1 break-all font-mono text-[12.5px] text-gold-deep">{`${siteUrl}/cupom/${c.code}`}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <CopyButton size="sm" variant="soft" value={`${siteUrl}/cupom/${c.code}`} label="Copiar link" />
                    <Button size="sm" variant="ghost" asChild>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Ganhe ${discountLabel(c)} no seu agendamento ✨ Use o link: ${siteUrl}/cupom/${c.code}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Enviar no WhatsApp
                      </a>
                    </Button>
                  </div>
                  {c.service_ids?.length === 1 ? (
                    <p className="mt-1.5 text-[11.5px] text-muted">O link já abre com o serviço do cupom escolhido.</p>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Button size="sm" variant="soft" onClick={() => setEditing(c)}>
                      <Pencil /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(c.code).then(() => toast.success("Código copiado."));
                      }}
                    >
                      <Copy /> Copiar código
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setCouponActiveAction(c.id, !c.active))}>
                      {c.active ? <PowerOff /> : <Power />} {c.active ? "Desativar" : "Ativar"}
                    </Button>
                    {c.uses === 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => confirm(`Excluir o cupom ${c.code}?`) && run(() => deleteCouponAction(c.id))}
                      >
                        <Trash2 /> Excluir
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        {editing !== undefined ? (
          <DialogContent title={editing ? `Editar ${editing.code}` : "Novo cupom"} className="sm:max-w-xl">
            <CouponForm coupon={editing} services={services} onDone={() => setEditing(undefined)} />
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

function CouponForm({ coupon, services, onDone }: { coupon: CouponRow | null; services: { id: string; name: string }[]; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [v, setV] = useState<CouponInput>({
    id: coupon?.id ?? null,
    code: coupon?.code ?? "",
    description: coupon?.description ?? "",
    discountType: coupon?.discount_type ?? "percent",
    discountValue: coupon ? (coupon.discount_type === "percent" ? String(coupon.discount_value) : centsToInput(coupon.discount_value)) : "",
    maxUses: coupon?.max_uses ?? "",
    oncePerClient: coupon?.once_per_client ?? true,
    minPrice: coupon?.min_price_cents ? centsToInput(coupon.min_price_cents) : "",
    validFrom: coupon?.valid_from ?? "",
    validUntil: coupon?.valid_until ?? "",
    serviceIds: coupon?.service_ids ?? [],
    active: coupon?.active ?? true,
  });
  const [limitServices, setLimitServices] = useState(Boolean(coupon?.service_ids?.length));

  return (
    <div className="space-y-4">
      <Field label="Nome do cupom (o que a cliente digita) *" htmlFor="cp-code" error={errors.code} hint="Ex.: BEMVINDA10, MAES2026. Sem espaços nem acentos.">
        <Input id="cp-code" className="font-mono uppercase" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} />
      </Field>
      <Field label="Descrição interna (opcional)" htmlFor="cp-desc">
        <Input id="cp-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: campanha Dia das Mães" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo de desconto" htmlFor="cp-type">
          <Select id="cp-type" value={v.discountType} onChange={(e) => setV({ ...v, discountType: e.target.value as "percent" | "fixed", discountValue: "" })}>
            <option value="percent">Porcentagem (%)</option>
            <option value="fixed">Valor fixo (R$)</option>
          </Select>
        </Field>
        <Field label={v.discountType === "percent" ? "Desconto (%) *" : "Desconto (R$) *"} htmlFor="cp-value" error={errors.discountValue}>
          <Input id="cp-value" inputMode="decimal" value={v.discountValue} onChange={(e) => setV({ ...v, discountValue: e.target.value })} placeholder={v.discountType === "percent" ? "10" : "20,00"} />
        </Field>
        <Field label="Quantidade de usos" htmlFor="cp-max" error={errors.maxUses} hint="Em branco = ilimitado">
          <Input id="cp-max" type="number" min={1} value={v.maxUses as string | number} onChange={(e) => setV({ ...v, maxUses: e.target.value === "" ? "" : Number(e.target.value) })} />
        </Field>
        <Field label="Valor mínimo do serviço (R$)" htmlFor="cp-min" hint="Opcional">
          <Input id="cp-min" inputMode="decimal" value={v.minPrice} onChange={(e) => setV({ ...v, minPrice: e.target.value })} />
        </Field>
        <Field label="Válido a partir de" htmlFor="cp-from">
          <Input id="cp-from" type="date" value={v.validFrom} onChange={(e) => setV({ ...v, validFrom: e.target.value })} />
        </Field>
        <Field label="Válido até" htmlFor="cp-until" error={errors.validUntil}>
          <Input id="cp-until" type="date" value={v.validUntil} onChange={(e) => setV({ ...v, validUntil: e.target.value })} />
        </Field>
      </div>
      <div className="space-y-3 rounded-2xl bg-ivory p-4 text-sm">
        <label className="flex items-center justify-between gap-4">
          <span>Cada cliente pode usar só 1 vez</span>
          <Switch checked={v.oncePerClient} onCheckedChange={(c) => setV({ ...v, oncePerClient: c })} />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Cupom ativo</span>
          <Switch checked={v.active} onCheckedChange={(c) => setV({ ...v, active: c })} />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span>Vale só para alguns serviços</span>
          <Switch
            checked={limitServices}
            onCheckedChange={(c) => {
              setLimitServices(c);
              if (!c) setV({ ...v, serviceIds: [] });
            }}
          />
        </label>
        {limitServices ? (
          <div className="grid max-h-48 gap-1.5 overflow-y-auto border-t border-line pt-3 sm:grid-cols-2">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[#b68d40]"
                  checked={(v.serviceIds ?? []).includes(s.id)}
                  onChange={(e) =>
                    setV({ ...v, serviceIds: e.target.checked ? [...(v.serviceIds ?? []), s.id] : (v.serviceIds ?? []).filter((x) => x !== s.id) })
                  }
                />
                {s.name}
              </label>
            ))}
          </div>
        ) : null}
      </div>
      <p className="text-[12.5px] text-muted">Cancelar um agendamento devolve o uso do cupom.</p>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          className="flex-1"
          disabled={pending}
          data-testid="salvar-cupom"
          onClick={() =>
            start(async () => {
              setErrors({});
              if (limitServices && !(v.serviceIds ?? []).length) {
                setErrors({ serviceIds: "Escolha os serviços" });
                toast.error("Escolha ao menos um serviço ou desligue a opção.");
                return;
              }
              const r = await saveCouponAction(v);
              if (r.ok) {
                toast.success(r.message ?? "Salvo!");
                router.refresh();
                onDone();
              } else {
                toast.error(r.error);
                setErrors(r.fieldErrors ?? {});
              }
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : null} Salvar cupom
        </Button>
      </div>
    </div>
  );
}
