"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff, CalendarRange, Loader2, Plus, Trash2 } from "lucide-react";
import { createBlockAction, deleteBlockAction, deleteSpecialDayAction, saveSpecialDayAction } from "@/app/admin/actions/schedule";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BLOCK_KIND_LABEL, type BlockKind } from "@/lib/constants";
import { formatDate, formatDateKey, formatTime } from "@/lib/format";

export interface BlockRow {
  id: string;
  kind: BlockKind;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  reason: string | null;
}
export interface SpecialRow {
  id: string;
  day: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
  note: string | null;
}

export function BlocksManager({ blocks, tz, today, openNew }: { blocks: BlockRow[]; tz: string; today: string; openNew?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(openNew));
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    kind: "bloqueio" as BlockKind,
    startDate: today,
    endDate: today,
    allDay: false,
    startTime: "12:00",
    endTime: "13:00",
    reason: "",
  });

  function describe(b: BlockRow) {
    if (b.all_day) {
      const endInclusive = new Date(new Date(b.ends_at).getTime() - 1000);
      const a = formatDate(b.starts_at, tz);
      const z = formatDate(endInclusive, tz);
      return a === z ? `${a} · dia inteiro` : `${a} até ${z} · dias inteiros`;
    }
    const sameDay = formatDate(b.starts_at, tz) === formatDate(b.ends_at, tz);
    return sameDay
      ? `${formatDate(b.starts_at, tz)} · ${formatTime(b.starts_at, tz)} às ${formatTime(b.ends_at, tz)}`
      : `${formatDate(b.starts_at, tz)} ${formatTime(b.starts_at, tz)} até ${formatDate(b.ends_at, tz)} ${formatTime(b.ends_at, tz)}`;
  }

  return (
    <div className="card-premium p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg">Bloqueios, férias e feriados</h3>
          <p className="text-sm text-muted">Períodos em que não haverá atendimento.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Bloquear
        </Button>
      </div>
      <ul className="mt-4 divide-y divide-line/70">
        {blocks.length === 0 ? <li className="py-6 text-center text-sm text-muted">Nenhum bloqueio futuro.</li> : null}
        {blocks.map((b) => (
          <li key={b.id} className="flex items-center gap-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cream text-gold">
              <CalendarOff className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {BLOCK_KIND_LABEL[b.kind]}
                {b.reason ? <span className="font-normal text-muted"> — {b.reason}</span> : null}
              </p>
              <p className="text-[13px] text-muted">{describe(b)}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Remover bloqueio"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteBlockAction(b.id);
                  if (r.ok) {
                    toast.success("Bloqueio removido.");
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Bloquear horário" description="Clientes não conseguirão agendar nesse período.">
          <div className="space-y-4">
            <Field label="Tipo" htmlFor="bk-kind">
              <Select id="bk-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as BlockKind })}>
                {Object.entries(BLOCK_KIND_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center justify-between rounded-2xl bg-ivory p-3 text-sm">
              Dia(s) inteiro(s)
              <Switch checked={form.allDay} onCheckedChange={(v) => setForm({ ...form, allDay: v })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data inicial" htmlFor="bk-sd">
                <Input id="bk-sd" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value > form.endDate ? e.target.value : form.endDate })} />
              </Field>
              <Field label="Data final" htmlFor="bk-ed">
                <Input id="bk-ed" type="date" min={form.startDate} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </Field>
              {!form.allDay ? (
                <>
                  <Field label="Hora inicial" htmlFor="bk-st">
                    <Input id="bk-st" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                  </Field>
                  <Field label="Hora final" htmlFor="bk-et">
                    <Input id="bk-et" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                  </Field>
                </>
              ) : null}
            </div>
            <Field label="Motivo (opcional)" htmlFor="bk-reason">
              <Input id="bk-reason" value={form.reason} maxLength={200} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </Field>
            <Button
              className="w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await createBlockAction(form);
                  if (r.ok) {
                    toast.success("Bloqueio criado.");
                    setOpen(false);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <CalendarRange />} Salvar bloqueio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SpecialDaysManager({ professionalId, days, today, canEdit }: { professionalId: string; days: SpecialRow[]; today: string; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ day: today, isClosed: false, open: "09:00", close: "14:00", breakStart: "", breakEnd: "", note: "" });
  const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

  return (
    <div className="card-premium p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg">Horários especiais</h3>
          <p className="text-sm text-muted">Um dia específico com horário diferente do habitual.</p>
        </div>
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus /> Adicionar
          </Button>
        ) : null}
      </div>
      <ul className="mt-4 divide-y divide-line/70">
        {days.length === 0 ? <li className="py-6 text-center text-sm text-muted">Nenhum horário especial futuro.</li> : null}
        {days.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium capitalize text-ink">{formatDateKey(d.day, "EEEE, dd/MM/yyyy")}</p>
              <p className="text-[13px] text-muted">
                {d.is_closed
                  ? "Fechado"
                  : `${hhmm(d.open_time)} às ${hhmm(d.close_time)}${d.break_start ? ` · intervalo ${hhmm(d.break_start)}–${hhmm(d.break_end)}` : ""}`}
                {d.note ? ` · ${d.note}` : ""}
              </p>
            </div>
            {canEdit ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remover"
                onClick={() =>
                  start(async () => {
                    const r = await deleteSpecialDayAction(d.id);
                    if (r.ok) router.refresh();
                    else toast.error(r.error);
                  })
                }
              >
                <Trash2 />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Horário especial">
          <div className="space-y-4">
            <Field label="Data" htmlFor="sp-day">
              <Input id="sp-day" type="date" min={today} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
            </Field>
            <label className="flex items-center justify-between rounded-2xl bg-ivory p-3 text-sm">
              Fechado neste dia
              <Switch checked={form.isClosed} onCheckedChange={(v) => setForm({ ...form, isClosed: v })} />
            </label>
            {!form.isClosed ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Abertura" htmlFor="sp-o">
                  <Input id="sp-o" type="time" value={form.open} onChange={(e) => setForm({ ...form, open: e.target.value })} />
                </Field>
                <Field label="Fechamento" htmlFor="sp-c">
                  <Input id="sp-c" type="time" value={form.close} onChange={(e) => setForm({ ...form, close: e.target.value })} />
                </Field>
                <Field label="Intervalo (início)" htmlFor="sp-bs">
                  <Input id="sp-bs" type="time" value={form.breakStart} onChange={(e) => setForm({ ...form, breakStart: e.target.value })} />
                </Field>
                <Field label="Intervalo (fim)" htmlFor="sp-be">
                  <Input id="sp-be" type="time" value={form.breakEnd} onChange={(e) => setForm({ ...form, breakEnd: e.target.value })} />
                </Field>
              </div>
            ) : null}
            <Field label="Observação (opcional)" htmlFor="sp-note">
              <Input id="sp-note" value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <Button
              className="w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveSpecialDayAction({ ...form, professionalId });
                  if (r.ok) {
                    toast.success("Horário especial salvo.");
                    setOpen(false);
                    router.refresh();
                  } else toast.error(r.error);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : null} Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
