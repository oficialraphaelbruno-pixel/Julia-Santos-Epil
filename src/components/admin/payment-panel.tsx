"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { deletePaymentAction, registerPaymentAction } from "@/app/admin/actions/appointments";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { centsToInput, formatDateTime, formatMoney } from "@/lib/format";

export interface PaymentRow {
  id: string;
  method: PaymentMethod;
  amount_cents: number;
  discount_cents: number;
  paid_at: string;
  kind: "pagamento" | "estorno";
}

export function PaymentPanel({
  appointmentId,
  priceCents,
  payments,
  tz,
  isOwner,
}: {
  appointmentId: string;
  priceCents: number;
  payments: PaymentRow[];
  tz: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const paid = payments.reduce((s, p) => s + (p.kind === "pagamento" ? p.amount_cents : -p.amount_cents), 0);
  const discount = payments.reduce((s, p) => s + p.discount_cents, 0);
  const remaining = Math.max(0, priceCents - paid - discount);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: centsToInput(remaining), discount: "", method: "pix" as PaymentMethod });
  const [pending, start] = useTransition();

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-display text-lg">Pagamento</p>
        <span className={remaining === 0 && paid > 0 ? "text-sm font-medium text-emerald-700" : "text-sm text-muted"}>
          {paid === 0 ? "Não registrado" : remaining === 0 ? "Quitado" : `Restante ${formatMoney(remaining)}`}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {payments.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl bg-ivory px-3 py-2 text-sm">
            <Wallet className="size-4 text-gold" />
            <span className="flex-1">
              {PAYMENT_METHOD_LABEL[p.method]} · {formatMoney(p.amount_cents)}
              {p.discount_cents ? ` (desconto ${formatMoney(p.discount_cents)})` : ""}
              <span className="block text-[12px] text-muted">{formatDateTime(p.paid_at, tz)}</span>
            </span>
            {isOwner ? (
              <button
                className="rounded-full p-1.5 text-muted hover:bg-white"
                aria-label="Excluir pagamento"
                onClick={() =>
                  confirm("Excluir este registro de pagamento?") &&
                  start(async () => {
                    const r = await deletePaymentAction(p.id, appointmentId);
                    if (r.ok) router.refresh();
                    else toast.error(r.error);
                  })
                }
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {open ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-line p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor recebido" htmlFor="pg-amount">
              <Input id="pg-amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Desconto" htmlFor="pg-disc">
              <Input id="pg-disc" inputMode="decimal" placeholder="0,00" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            </Field>
          </div>
          <Field label="Forma de pagamento" htmlFor="pg-method">
            <Select id="pg-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await registerPaymentAction({ appointmentId, ...form });
                  if (r.ok) {
                    toast.success("Pagamento registrado.");
                    setOpen(false);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : null} Registrar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="soft" className="mt-3" onClick={() => setOpen(true)}>
          <Plus /> Registrar pagamento
        </Button>
      )}
    </div>
  );
}
