import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { notifyAppointment } from "@/lib/appointment-events";
import { addDaysKey, localToUtcIso, todayKey } from "@/lib/format";

export const maxDuration = 60;

/**
 * Lembretes automáticos. Chamado pelo agendador da Vercel (vercel.json) com
 * "Authorization: Bearer CRON_SECRET". Duplicidade é evitada pelo registro de mensagens.
 *  - Véspera: agendamentos de amanhã (rodando 1x ao dia já atende).
 *  - 2 horas antes: exige execução de hora em hora (plano Pro da Vercel).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const db = createServiceClient();
  const { data: settings } = await db
    .from("notification_settings")
    .select("business_id, email_reminder_day_before, email_reminder_2h, whatsapp_api_enabled, business:businesses(timezone)");
  const summary = { vespera: 0, duasHoras: 0 };

  for (const s of settings ?? []) {
    const tz = (s.business as unknown as { timezone: string }).timezone;
    if (s.email_reminder_day_before || s.whatsapp_api_enabled) {
      const tomorrow = addDaysKey(todayKey(tz), 1);
      const { data } = await db
        .from("appointments")
        .select("id")
        .eq("business_id", s.business_id)
        .in("status", ["pending", "confirmed"])
        .gte("starts_at", localToUtcIso(tomorrow, "00:00", tz))
        .lt("starts_at", localToUtcIso(addDaysKey(tomorrow, 1), "00:00", tz));
      for (const a of data ?? []) {
        await notifyAppointment(a.id, "reminder_day_before");
        summary.vespera++;
      }
    }
    if (s.email_reminder_2h) {
      const now = Date.now();
      const { data } = await db
        .from("appointments")
        .select("id")
        .eq("business_id", s.business_id)
        .in("status", ["pending", "confirmed"])
        .gte("starts_at", new Date(now + 60 * 60000).toISOString())
        .lt("starts_at", new Date(now + 180 * 60000).toISOString());
      for (const a of data ?? []) {
        await notifyAppointment(a.id, "reminder_2h");
        summary.duasHoras++;
      }
    }
  }
  return NextResponse.json({ ok: true, verificados: summary });
}
