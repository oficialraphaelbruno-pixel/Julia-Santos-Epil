"use client";
import { Loader2 } from "lucide-react";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Slot } from "@/app/agendar/actions";

function period(iso: string, tz: string) {
  const h = Number(formatTime(iso, tz).slice(0, 2));
  return h < 12 ? "Manhã" : h < 18 ? "Tarde" : "Noite";
}

export function SlotPicker({
  slots,
  loading,
  selected,
  onSelect,
  tz,
}: {
  slots: Slot[];
  loading: boolean;
  selected: string | null;
  onSelect: (slot: Slot) => void;
  tz: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
        <Loader2 className="size-4 animate-spin text-gold" /> Buscando horários livres…
      </div>
    );
  }
  if (!slots.length) {
    return <p className="py-8 text-center text-sm text-muted">Não há horários livres nesta data. Escolha outro dia.</p>;
  }
  const groups = ["Manhã", "Tarde", "Noite"]
    .map((p) => ({ p, items: slots.filter((s) => period(s.start, tz) === p) }))
    .filter((g) => g.items.length);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.p}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{g.p}</p>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {g.items.map((s) => {
              const active = selected === s.start;
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => onSelect(s)}
                  aria-pressed={active}
                  className={cn(
                    "h-12 rounded-2xl border text-[15px] font-medium tabular-nums transition-all duration-200",
                    active
                      ? "border-transparent bg-[linear-gradient(135deg,#c9a35f,#92702e)] text-white shadow-[0_6px_16px_-6px_rgba(146,112,46,0.7)]"
                      : "border-line bg-white text-ink hover:border-champagne hover:bg-ivory",
                  )}
                >
                  {formatTime(s.start, tz)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
