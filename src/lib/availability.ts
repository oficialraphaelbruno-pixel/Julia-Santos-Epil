import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { getBusyIntervals, overlapsBusy } from "@/lib/google-calendar";

export interface SlotIso {
  start: string;
  end: string;
}

/**
 * Remove horários que colidem com compromissos do Google Agenda.
 * externalVerified=false quando a consulta ao Google falhou: os horários
 * exibidos foram verificados SOMENTE na agenda interna.
 */
export async function filterSlotsByGoogle(businessId: string, serviceId: string, slots: SlotIso[]) {
  if (slots.length === 0) return { slots, externalVerified: true, connected: false };
  const db = createServiceClient();
  const { data: svc } = await db.from("services").select("prep_minutes, buffer_after_minutes").eq("id", serviceId).maybeSingle();
  const prep = (svc?.prep_minutes ?? 0) * 60000;
  const buf = (svc?.buffer_after_minutes ?? 0) * 60000;
  const min = new Date(Date.parse(slots[0].start) - prep - 3600000).toISOString();
  const max = new Date(Date.parse(slots[slots.length - 1].end) + buf + 3600000).toISOString();
  const busy = await getBusyIntervals(businessId, min, max);
  if (!busy.connected) return { slots, externalVerified: true, connected: false };
  if (!busy.ok) return { slots, externalVerified: false, connected: true };
  return {
    slots: slots.filter((s) => !overlapsBusy(busy.intervals, Date.parse(s.start) - prep, Date.parse(s.end) + buf)),
    externalVerified: true,
    connected: true,
  };
}

/** Verifica um único horário contra o Google. busy=true se houver conflito externo. */
export async function checkSlotAgainstGoogle(businessId: string, serviceId: string, start: string) {
  const db = createServiceClient();
  const { data: svc } = await db.from("services").select("duration_minutes").eq("id", serviceId).maybeSingle();
  const end = new Date(Date.parse(start) + (svc?.duration_minutes ?? 60) * 60000).toISOString();
  const r = await filterSlotsByGoogle(businessId, serviceId, [{ start, end }]);
  return { busy: r.slots.length === 0, externalVerified: r.externalVerified, connected: r.connected };
}
