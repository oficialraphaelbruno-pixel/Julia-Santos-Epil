"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCheck, CircleCheck, Loader2, Play, RotateCcw, UserX } from "lucide-react";
import { setAppointmentStatusAction } from "@/app/admin/actions/appointments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import type { AppointmentStatus } from "@/lib/constants";

export function AppointmentStatusActions({ id, status }: { id: string; status: AppointmentStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const run = (s: AppointmentStatus, msg: string, r?: string) =>
    start(async () => {
      const res = await setAppointmentStatusAction(id, s, r);
      if (res.ok) {
        toast.success(msg);
        setCancelOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });

  const active = status === "pending" || status === "confirmed" || status === "in_progress";

  return (
    <div className="flex flex-wrap gap-2">
      {pending ? <Loader2 className="size-5 animate-spin self-center text-gold" /> : null}
      {status === "pending" ? (
        <Button size="sm" onClick={() => run("confirmed", "Agendamento confirmado.")} disabled={pending} data-testid="btn-confirmar">
          <CircleCheck /> Confirmar
        </Button>
      ) : null}
      {status === "confirmed" || status === "pending" ? (
        <Button size="sm" variant="outline" onClick={() => run("in_progress", "Atendimento iniciado.")} disabled={pending}>
          <Play /> Iniciar atendimento
        </Button>
      ) : null}
      {active ? (
        <Button size="sm" variant="outline" onClick={() => run("completed", "Atendimento concluído.")} disabled={pending} data-testid="btn-concluir">
          <CheckCheck /> Concluir
        </Button>
      ) : null}
      {status === "confirmed" || status === "pending" ? (
        <Button size="sm" variant="ghost" onClick={() => run("no_show", "Falta registrada.")} disabled={pending}>
          <UserX /> Não compareceu
        </Button>
      ) : null}
      {active ? (
        <Button size="sm" variant="danger-outline" onClick={() => setCancelOpen(true)} disabled={pending} data-testid="btn-cancelar">
          <Ban /> Cancelar
        </Button>
      ) : null}
      {status === "cancelled" || status === "no_show" || status === "completed" ? (
        <Button size="sm" variant="ghost" onClick={() => run("confirmed", "Agendamento reativado.")} disabled={pending}>
          <RotateCcw /> Reativar
        </Button>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent title="Cancelar agendamento" description="O horário será liberado na agenda.">
          <Textarea rows={3} placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button variant="danger" className="flex-1" disabled={pending} onClick={() => run("cancelled", "Agendamento cancelado.", reason)} data-testid="btn-confirmar-cancelamento">
              Confirmar cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
