"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2, XCircle } from "lucide-react";
import { BookingCalendar } from "@/components/booking/booking-calendar";
import { SlotPicker } from "@/components/booking/slot-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cancelByTokenAction, rescheduleByTokenAction, rescheduleDaysAction, rescheduleSlotsAction } from "@/app/agendamento/actions";
import type { Slot } from "@/app/agendar/actions";
import { formatDate, formatTime } from "@/lib/format";

export function ManageBookingActions({
  token,
  tz,
  canCancel,
  canReschedule,
  todayKey,
  maxKey,
}: {
  token: string;
  tz: string;
  canCancel: boolean;
  canReschedule: boolean;
  todayKey: string;
  maxKey: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "cancel" | "reschedule">("idle");
  const [reason, setReason] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [pending, start] = useTransition();

  const loadDays = useCallback((from: string, to: string) => rescheduleDaysAction(token, from, to), [token]);

  if (!canCancel && !canReschedule) return null;

  return (
    <div className="mt-6 space-y-4">
      {mode === "idle" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {canReschedule ? (
            <Button variant="outline" onClick={() => setMode("reschedule")}>
              <CalendarClock /> Reagendar
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="danger-outline" onClick={() => setMode("cancel")}>
              <XCircle /> Cancelar agendamento
            </Button>
          ) : null}
        </div>
      ) : null}

      {mode === "cancel" ? (
        <div className="animate-fade-up rounded-3xl border border-rose-200 bg-white p-5">
          <p className="font-display text-lg text-ink">Cancelar este agendamento?</p>
          <p className="mt-1 text-sm text-muted">O horário será liberado para outras clientes.</p>
          <Textarea className="mt-4" rows={2} placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="ghost" className="flex-1" onClick={() => setMode("idle")}>
              Voltar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await cancelByTokenAction(token, reason);
                  if (res.ok) {
                    toast.success("Agendamento cancelado.");
                    setMode("idle");
                    router.refresh();
                  } else toast.error(res.error);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : null} Confirmar cancelamento
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "reschedule" ? (
        <div className="animate-fade-up space-y-4">
          <BookingCalendar
            todayKey={todayKey}
            maxKey={maxKey}
            selected={day}
            loadDays={loadDays}
            onSelect={async (d) => {
              setDay(d);
              setSlot(null);
              setLoadingSlots(true);
              try {
                setSlots(await rescheduleSlotsAction(token, d));
              } finally {
                setLoadingSlots(false);
              }
            }}
          />
          {day ? (
            <div className="rounded-3xl border border-line bg-white p-5 shadow-soft">
              <SlotPicker slots={slots} loading={loadingSlots} selected={slot?.start ?? null} onSelect={setSlot} tz={tz} />
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="ghost" className="flex-1" onClick={() => setMode("idle")}>
              Voltar
            </Button>
            <Button
              className="flex-1"
              disabled={!slot || pending}
              onClick={() =>
                slot &&
                start(async () => {
                  const res = await rescheduleByTokenAction(token, slot.start);
                  if (res.ok) {
                    toast.success(`Reagendado para ${formatDate(slot.start, tz)} às ${formatTime(slot.start, tz)}.`);
                    setMode("idle");
                    setDay(null);
                    setSlot(null);
                    router.refresh();
                  } else {
                    toast.error(res.error);
                    if (day) setSlots(await rescheduleSlotsAction(token, day));
                  }
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              {slot ? `Confirmar ${formatDate(slot.start, tz)} às ${formatTime(slot.start, tz)}` : "Escolha um horário"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
