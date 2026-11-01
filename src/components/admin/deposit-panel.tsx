"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, CircleSlash, Loader2, Undo2 } from "lucide-react";
import { confirmDepositAction, setDepositStatusAction } from "@/app/admin/actions/appointments";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { DepositStatus } from "@/lib/types";

const LABEL: Record<DepositStatus, [string, string]> = {
  nao_exigido: ["Não exigido", "text-muted"],
  aguardando: ["Aguardando Pix", "text-amber-700"],
  pago: ["Recebido", "text-emerald-700"],
  dispensado: ["Dispensado", "text-muted"],
  devolvido: ["Devolvido", "text-rose-700"],
};

export function DepositPanel({
  appointmentId,
  amountCents,
  status,
  dueAt,
  paidAt,
  appointmentStatus,
  tz,
  overdue,
}: {
  appointmentId: string;
  amountCents: number;
  status: DepositStatus;
  dueAt: string | null;
  paidAt: string | null;
  appointmentStatus: string;
  tz: string;
  overdue: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Feito.");
        router.refresh();
      } else toast.error(r.error);
    });

  if (status === "nao_exigido") return null;

  return (
    <div data-testid="deposit-panel">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg">Sinal (Pix)</p>
        <span className={`text-sm font-medium ${LABEL[status][1]}`}>{LABEL[status][0]}</span>
      </div>
      <p className="mt-1 text-2xl font-display text-gold-deep">{formatMoney(amountCents)}</p>
      {status === "aguardando" && dueAt ? (
        <p className={`mt-1 text-[13px] ${overdue ? "font-medium text-rose-700" : "text-muted"}`}>
          {overdue ? "Prazo vencido em " : "Prazo: "}
          {formatDateTime(dueAt, tz)}
        </p>
      ) : null}
      {status === "pago" && paidAt ? <p className="mt-1 text-[13px] text-muted">Recebido em {formatDateTime(paidAt, tz)}</p> : null}

      {status === "aguardando" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => confirmDepositAction(appointmentId, appointmentStatus === "pending"))} data-testid="btn-sinal-recebido">
            {pending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
            {appointmentStatus === "pending" ? "Sinal recebido e confirmar" : "Sinal recebido"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => confirm("Dispensar o sinal deste agendamento?") && run(() => setDepositStatusAction(appointmentId, "dispensado"))}
          >
            <CircleSlash /> Dispensar sinal
          </Button>
        </div>
      ) : null}
      {status === "pago" ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-3"
          disabled={pending}
          onClick={() => confirm("Registrar a devolução do sinal? Um estorno será lançado no financeiro.") && run(() => setDepositStatusAction(appointmentId, "devolvido"))}
        >
          <Undo2 /> Registrar devolução
        </Button>
      ) : null}
      <p className="mt-3 text-[12px] text-muted">Confira o Pix no app do banco antes de marcar como recebido.</p>
    </div>
  );
}
