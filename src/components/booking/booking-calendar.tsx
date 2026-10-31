"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { addDaysKey, formatDateKey, weekdayOfKey } from "@/lib/format";
import { cn } from "@/lib/utils";

const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];

function monthStartKey(key: string) {
  return key.slice(0, 8) + "01";
}
function monthEndKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${key.slice(0, 8)}${String(last).padStart(2, "0")}`;
}
function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Calendário mensal que consulta no servidor apenas os dias com horários livres.
 */
export function BookingCalendar({
  todayKey,
  maxKey,
  selected,
  onSelect,
  loadDays,
}: {
  todayKey: string;
  maxKey: string;
  selected: string | null;
  onSelect: (day: string) => void;
  loadDays: (from: string, to: string) => Promise<string[]>;
}) {
  const [month, setMonth] = useState(monthStartKey(selected ?? todayKey));
  const [available, setAvailable] = useState<Set<string>>(new Set());
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const loading = loadedMonth !== month;
  // Se o mês inicial não tiver datas livres, avança automaticamente (até 2 meses).
  const autoAdvance = useRef(selected ? 0 : 2);

  useEffect(() => {
    let alive = true;
    const from = month < todayKey ? todayKey : month;
    const end = monthEndKey(month);
    const to = end > maxKey ? maxKey : end;
    const request = from > to ? Promise.resolve<string[]>([]) : loadDays(from, to);
    request
      .then((days) => {
        if (!alive) return;
        if (days.length === 0 && autoAdvance.current > 0 && shiftMonth(month, 1) <= maxKey) {
          autoAdvance.current -= 1;
          setMonth(shiftMonth(month, 1));
          return;
        }
        autoAdvance.current = 0;
        setAvailable(new Set(days));
        setLoadedMonth(month);
      })
      .catch(() => alive && setLoadedMonth(month));
    return () => {
      alive = false;
    };
  }, [month, todayKey, maxKey, loadDays]);

  const cells = useMemo(() => {
    const first = month;
    const pad = weekdayOfKey(first);
    const last = monthEndKey(month);
    const days: (string | null)[] = Array.from({ length: pad }, () => null);
    for (let d = first; d <= last; d = addDaysKey(d, 1)) days.push(d);
    return days;
  }, [month]);

  const canPrev = month > monthStartKey(todayKey);
  const canNext = shiftMonth(month, 1) <= maxKey;

  return (
    <div className="rounded-3xl border border-line bg-white p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          disabled={!canPrev}
          className="grid size-10 place-items-center rounded-full text-gold-dark transition hover:bg-cream disabled:opacity-30"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-display text-lg capitalize text-ink">
          {formatDateKey(month, "MMMM 'de' yyyy")}
          {loading ? <Loader2 className="ml-2 inline size-4 animate-spin text-gold" /> : null}
        </p>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          disabled={!canNext}
          className="grid size-10 place-items-center rounded-full text-gold-dark transition hover:bg-cream disabled:opacity-30"
          aria-label="Próximo mês"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
        {WEEK.map((w, i) => (
          <div key={i} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Datas disponíveis">
        {cells.map((d, i) => {
          if (!d) return <div key={`p${i}`} />;
          const isAvailable = available.has(d);
          const isSelected = selected === d;
          const isToday = d === todayKey;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              disabled={!isAvailable || loading}
              onClick={() => onSelect(d)}
              aria-selected={isSelected}
              aria-label={`${formatDateKey(d, "EEEE, dd 'de' MMMM")}${isAvailable ? ", disponível" : ", indisponível"}`}
              className={cn(
                "relative mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-full text-[15px] transition-all duration-200",
                isSelected
                  ? "bg-[linear-gradient(135deg,#c9a35f,#92702e)] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(146,112,46,0.7)]"
                  : isAvailable
                    ? "font-medium text-ink hover:bg-cream"
                    : "text-ink/25",
              )}
            >
              {Number(d.slice(8))}
              {isAvailable && !isSelected ? <span className="absolute bottom-1.5 size-1 rounded-full bg-champagne" /> : null}
              {isToday && !isSelected ? <span className="absolute inset-1 rounded-full ring-1 ring-champagne/50" /> : null}
            </button>
          );
        })}
      </div>
      {!loading && available.size === 0 ? (
        <p className="mt-4 text-center text-sm text-muted">Nenhum horário disponível neste mês. Tente o próximo.</p>
      ) : null}
    </div>
  );
}
