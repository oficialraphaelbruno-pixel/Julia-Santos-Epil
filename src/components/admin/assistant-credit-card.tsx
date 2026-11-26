"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Loader2, Pencil, Wallet } from "lucide-react";
import { saveAssistantCreditAction } from "@/app/admin/actions/assistant";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { formatUsd } from "@/lib/credit";
import { cn } from "@/lib/utils";

export interface CreditCardData {
  creditUsd: number | null;
  creditSince: string | null;
  creditSinceLabel: string | null;
  lowBalanceUsd: number;
  priceInput: number;
  priceOutput: number;
  balance: number | null;
  percentLeft: number | null;
  level: "ok" | "low" | "empty" | "unknown";
  spentUsd: number;
  spentSource: "real" | "estimado";
  estimatedUsd: number;
  realError: string | null;
  todayUsd: number;
  monthUsd: number;
  messagesSince: number;
  adminKey: boolean;
}

const BILLING_URL = "https://platform.openai.com/settings/organization/billing/overview";

export function AssistantCreditCard({ data, canEdit, isPlatformAdmin, today }: { data: CreditCardData; canEdit: boolean; isPlatformAdmin: boolean; today: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(data.creditUsd === null);
  const [credit, setCredit] = useState(data.creditUsd !== null ? String(data.creditUsd).replace(".", ",") : "");
  const [since, setSince] = useState(data.creditSince ?? today);
  const [low, setLow] = useState(String(data.lowBalanceUsd).replace(".", ","));
  const [priceIn, setPriceIn] = useState(String(data.priceInput).replace(".", ","));
  const [priceOut, setPriceOut] = useState(String(data.priceOutput).replace(".", ","));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const tone =
    data.level === "empty" ? "border-rose-200 bg-rose-50 text-rose-800" : data.level === "low" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  const bar = data.level === "empty" ? "bg-rose-500" : data.level === "low" ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="card-premium space-y-4 p-5 sm:p-6" data-testid="credit-card">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-lg text-ink">
          <Wallet className="size-5 text-gold" /> Crédito da OpenAI
        </p>
        <a href={BILLING_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-gold-dark hover:underline">
          Abastecer <ExternalLink className="size-3.5" />
        </a>
      </div>

      {data.balance !== null ? (
        <div className={cn("rounded-2xl border p-4", tone)} data-testid="credit-balance">
          <p className="text-[12.5px] uppercase tracking-wider opacity-80">Saldo estimado</p>
          <p className="font-display text-3xl">{formatUsd(Math.max(data.balance, 0))}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
            <div className={cn("h-full rounded-full", bar)} style={{ width: `${data.percentLeft ?? 0}%` }} />
          </div>
          <p className="mt-2 text-[13px]">
            {formatUsd(data.creditUsd ?? 0)} colocados em {data.creditSinceLabel} − {formatUsd(data.spentUsd)} gastos ({data.spentSource === "real" ? "valor da OpenAI" : "estimativa"})
          </p>
          {data.level !== "ok" ? (
            <p className="mt-2 flex items-start gap-1.5 text-[13px] font-medium" data-testid="credit-alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {data.level === "empty" ? "Crédito esgotado: a assistente para de responder. Abasteça a conta na OpenAI." : "Hora de abastecer: o saldo está abaixo do limite que você definiu."}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="rounded-2xl bg-ivory p-4 text-[13px] text-muted">Informe quanto você colocou de crédito na OpenAI para o painel calcular o saldo.</p>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-ivory p-3">
          <p className="text-[12px] text-muted">Gasto hoje (estimado)</p>
          <p className="font-medium text-ink" data-testid="credit-today">{formatUsd(data.todayUsd, 4)}</p>
        </div>
        <div className="rounded-2xl bg-ivory p-3">
          <p className="text-[12px] text-muted">Gasto no mês (estimado)</p>
          <p className="font-medium text-ink">{formatUsd(data.monthUsd, 4)}</p>
        </div>
      </div>
      <p className="text-[12.5px] text-muted">
        {data.messagesSince} mensagem(ns) da assistente {data.creditSinceLabel ? `desde ${data.creditSinceLabel}` : "nos últimos 30 dias"}.{" "}
        {data.spentSource === "real"
          ? "O gasto acima vem direto da OpenAI (inclui tudo o que a conta usou)."
          : data.adminKey && data.realError
            ? `Não consegui ler o gasto real na OpenAI (${data.realError}); usando a estimativa.`
            : "Estimativa pelo consumo de cada mensagem. O valor oficial fica no painel da OpenAI."}
      </p>

      {canEdit && !editing ? (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="credit-editar">
          <Pencil /> Registrar recarga
        </Button>
      ) : null}

      {canEdit && editing ? (
        <form
          className="space-y-3 rounded-2xl border border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveAssistantCreditAction({
                creditUsd: credit,
                creditSince: credit ? since : "",
                lowBalanceUsd: low,
                ...(isPlatformAdmin ? { priceInput: priceIn, priceOutput: priceOut } : {}),
              });
              if (r.ok) {
                toast.success(r.message ?? "Salvo.");
                setErrors({});
                setEditing(false);
                router.refresh();
              } else {
                setErrors(r.fieldErrors ?? {});
                toast.error(r.error);
              }
            });
          }}
        >
          <p className="text-[13px] text-muted">
            Sempre que abastecer, informe o <b>saldo que ficou na OpenAI</b> (aparece em Billing) e a data de hoje. O painel desconta o que a assistente gastar a partir daí.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Saldo na OpenAI (US$)" htmlFor="cr-valor" error={errors.creditUsd}>
              <Input id="cr-valor" inputMode="decimal" placeholder="10,00" value={credit} onChange={(e) => setCredit(e.target.value)} />
            </Field>
            <Field label="Data" htmlFor="cr-data" error={errors.creditSince}>
              <Input id="cr-data" type="date" value={since} max={today} onChange={(e) => setSince(e.target.value)} />
            </Field>
          </div>
          <Field label="Avisar quando o saldo ficar abaixo de (US$)" htmlFor="cr-alerta" error={errors.lowBalanceUsd}>
            <Input id="cr-alerta" inputMode="decimal" value={low} onChange={(e) => setLow(e.target.value)} className="max-w-40" />
          </Field>
          {isPlatformAdmin ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Preço entrada (US$ por 1 milhão de tokens)" htmlFor="cr-pin" error={errors.priceInput} hint="Confira em openai.com/api/pricing para o modelo usado.">
                <Input id="cr-pin" inputMode="decimal" value={priceIn} onChange={(e) => setPriceIn(e.target.value)} />
              </Field>
              <Field label="Preço saída (US$ por 1 milhão de tokens)" htmlFor="cr-pout" error={errors.priceOutput}>
                <Input id="cr-pout" inputMode="decimal" value={priceOut} onChange={(e) => setPriceOut(e.target.value)} />
              </Field>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            {data.creditUsd !== null ? (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" disabled={pending} data-testid="credit-salvar">
              {pending ? <Loader2 className="animate-spin" /> : null} Salvar
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
