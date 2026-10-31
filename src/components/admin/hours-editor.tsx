"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, Save } from "lucide-react";
import { saveWorkingHoursAction } from "@/app/admin/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { WEEKDAYS } from "@/lib/format";
import type { WorkingHour } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DayState {
  weekday: number;
  isOpen: boolean;
  open: string;
  close: string;
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
// Exibe de segunda a domingo
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export function HoursEditor({ professionalId, hours, canEdit }: { professionalId: string; hours: WorkingHour[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [days, setDays] = useState<DayState[]>(() =>
    ORDER.map((wd) => {
      const h = hours.find((x) => x.weekday === wd);
      return {
        weekday: wd,
        isOpen: h?.is_open ?? false,
        open: hhmm(h?.open_time ?? null),
        close: hhmm(h?.close_time ?? null),
        hasBreak: Boolean(h?.break_start),
        breakStart: hhmm(h?.break_start ?? null),
        breakEnd: hhmm(h?.break_end ?? null),
      };
    }),
  );

  const update = (i: number, patch: Partial<DayState>) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function copyToAll(i: number) {
    const src = days[i];
    setDays((d) => d.map((x) => (x.isOpen ? { ...x, open: src.open, close: src.close, hasBreak: src.hasBreak, breakStart: src.breakStart, breakEnd: src.breakEnd } : x)));
    toast.success("Horário copiado para os dias abertos.");
  }

  return (
    <div className="card-premium overflow-hidden">
      <div className="divide-y divide-line/70">
        {days.map((d, i) => (
          <div key={d.weekday} className={cn("p-4 sm:px-6", !d.isOpen && "bg-ivory/50")}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <label className="flex w-44 items-center gap-3">
                <Switch checked={d.isOpen} disabled={!canEdit} onCheckedChange={(v) => update(i, { isOpen: v, open: d.open || "09:00", close: d.close || "18:00" })} aria-label={`${WEEKDAYS[d.weekday]} aberto`} />
                <span className={cn("text-[15px] font-medium", d.isOpen ? "text-ink" : "text-muted")}>{WEEKDAYS[d.weekday]}</span>
              </label>
              {d.isOpen ? (
                <>
                  <div className="flex items-center gap-2">
                    <Input type="time" className="h-10 w-28" value={d.open} disabled={!canEdit} onChange={(e) => update(i, { open: e.target.value })} aria-label="Abertura" />
                    <span className="text-muted">às</span>
                    <Input type="time" className="h-10 w-28" value={d.close} disabled={!canEdit} onChange={(e) => update(i, { close: e.target.value })} aria-label="Fechamento" />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-ink/70">
                    <input
                      type="checkbox"
                      className="accent-[#b68d40]"
                      checked={d.hasBreak}
                      disabled={!canEdit}
                      onChange={(e) => update(i, { hasBreak: e.target.checked, breakStart: d.breakStart || "12:00", breakEnd: d.breakEnd || "13:00" })}
                    />
                    Almoço
                  </label>
                  {d.hasBreak ? (
                    <div className="flex items-center gap-2">
                      <Input type="time" className="h-10 w-28" value={d.breakStart} disabled={!canEdit} onChange={(e) => update(i, { breakStart: e.target.value })} aria-label="Início do intervalo" />
                      <span className="text-muted">às</span>
                      <Input type="time" className="h-10 w-28" value={d.breakEnd} disabled={!canEdit} onChange={(e) => update(i, { breakEnd: e.target.value })} aria-label="Fim do intervalo" />
                    </div>
                  ) : null}
                  {canEdit ? (
                    <button type="button" onClick={() => copyToAll(i)} className="ml-auto inline-flex items-center gap-1 text-xs text-gold-dark hover:underline">
                      <Copy className="size-3.5" /> Copiar para todos
                    </button>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-muted">Fechado</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {canEdit ? (
        <div className="flex justify-end border-t border-line/70 bg-ivory/40 p-4 sm:px-6">
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const payload = days.map((d) => ({
                  weekday: d.weekday,
                  isOpen: d.isOpen,
                  open: d.open,
                  close: d.close,
                  breakStart: d.hasBreak ? d.breakStart : "",
                  breakEnd: d.hasBreak ? d.breakEnd : "",
                }));
                const res = await saveWorkingHoursAction(professionalId, payload);
                if (res.ok) {
                  toast.success(res.message ?? "Salvo!");
                  router.refresh();
                } else toast.error(res.error);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Salvar horários
          </Button>
        </div>
      ) : null}
    </div>
  );
}
