"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { disconnectGoogleAction, listGoogleCalendarsAction, selectGoogleCalendarAction, syncUpcomingAction } from "@/app/admin/actions/integrations";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

export function GoogleIntegrationControls({ calendarId }: { calendarId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [calendars, setCalendars] = useState<{ id: string; summary: string; primary: boolean }[] | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await listGoogleCalendarsAction();
              if (r.ok) setCalendars(r.data ?? []);
              else toast.error(r.error);
            })
          }
        >
          <CalendarCheck2 /> Escolher agenda
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await syncUpcomingAction();
              if (r.ok) toast.success(r.message ?? "Sincronizado.");
              else toast.error(r.error);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sincronizar agora
        </Button>
        <Button
          size="sm"
          variant="danger-outline"
          disabled={pending}
          onClick={() =>
            confirm("Desconectar o Google Agenda? Os eventos já criados permanecem na sua agenda do Google.") &&
            start(async () => {
              const r = await disconnectGoogleAction();
              if (r.ok) toast.success(r.message ?? "Desconectado.");
              else toast.error(r.error);
              router.refresh();
            })
          }
        >
          <Unplug /> Desconectar
        </Button>
      </div>
      {calendars ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            aria-label="Agenda do Google"
            defaultValue={calendarId ?? ""}
            id="g-cal"
            className="sm:max-w-sm"
          >
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.summary}
                {c.primary ? " (principal)" : ""}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            className="h-11"
            disabled={pending}
            onClick={() => {
              const sel = document.getElementById("g-cal") as HTMLSelectElement;
              const cal = calendars.find((c) => c.id === sel.value);
              if (!cal) return;
              start(async () => {
                const r = await selectGoogleCalendarAction(cal.id, cal.summary);
                if (r.ok) {
                  toast.success("Agenda selecionada.");
                  setCalendars(null);
                  router.refresh();
                } else toast.error(r.error);
              });
            }}
          >
            Usar esta agenda
          </Button>
        </div>
      ) : null}
    </div>
  );
}
