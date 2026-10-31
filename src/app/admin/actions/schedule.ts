"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { addDaysKey, localToUtcIso } from "@/lib/format";
import { friendlyDbError } from "@/lib/constants";
import { dateKeySchema, timeSchema } from "@/lib/schemas";
import type { ActionResult } from "@/lib/action";

const optTime = z.union([timeSchema, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));

const daySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    isOpen: z.boolean(),
    open: optTime,
    close: optTime,
    breakStart: optTime,
    breakEnd: optTime,
  })
  .superRefine((d, ctx) => {
    if (!d.isOpen) return;
    if (!d.open || !d.close) ctx.addIssue({ code: "custom", message: "Informe abertura e fechamento" });
    else if (d.close <= d.open) ctx.addIssue({ code: "custom", message: "O fechamento deve ser depois da abertura" });
    if ((d.breakStart && !d.breakEnd) || (!d.breakStart && d.breakEnd)) ctx.addIssue({ code: "custom", message: "Informe início e fim do intervalo" });
    if (d.breakStart && d.breakEnd) {
      if (d.breakEnd <= d.breakStart) ctx.addIssue({ code: "custom", message: "Intervalo inválido" });
      if (d.open && d.close && (d.breakStart < d.open || d.breakEnd > d.close))
        ctx.addIssue({ code: "custom", message: "O intervalo deve estar dentro do expediente" });
    }
  });

const WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function refresh() {
  revalidatePath("/admin/horarios");
  revalidatePath("/admin/agenda");
}

export async function saveWorkingHoursAction(professionalId: string, days: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(professionalId).success) return { ok: false, error: "Profissional inválida." };
    const parsed = z.array(daySchema).length(7).safeParse(days);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const idx = typeof issue.path[0] === "number" ? issue.path[0] : null;
      return { ok: false, error: idx !== null ? `${WEEK[(days as { weekday: number }[])[idx]?.weekday ?? idx]}: ${issue.message}` : issue.message };
    }
    const rows = parsed.data.map((d) => ({
      business_id: ctx.business.id,
      professional_id: professionalId,
      weekday: d.weekday,
      is_open: d.isOpen,
      open_time: d.isOpen ? d.open : null,
      close_time: d.isOpen ? d.close : null,
      break_start: d.isOpen ? d.breakStart : null,
      break_end: d.isOpen ? d.breakEnd : null,
    }));
    const { error } = await ctx.supabase.from("working_hours").upsert(rows, { onConflict: "professional_id,weekday" });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, message: "Horários salvos." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

const blockSchema = z
  .object({
    professionalId: z.string().optional().nullable(),
    kind: z.enum(["bloqueio", "ferias", "feriado", "pessoal"]),
    startDate: dateKeySchema,
    endDate: dateKeySchema,
    allDay: z.boolean(),
    startTime: optTime,
    endTime: optTime,
    reason: z.string().trim().max(200).optional().default(""),
  })
  .superRefine((b, ctx) => {
    if (b.endDate < b.startDate) ctx.addIssue({ code: "custom", message: "A data final deve ser igual ou posterior à inicial" });
    if (!b.allDay) {
      if (!b.startTime || !b.endTime) ctx.addIssue({ code: "custom", message: "Informe os horários" });
      else if (b.startDate === b.endDate && b.endTime <= b.startTime) ctx.addIssue({ code: "custom", message: "O horário final deve ser depois do inicial" });
    }
  });

export async function createBlockAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin();
    const parsed = blockSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const b = parsed.data;
    const tz = ctx.business.timezone;
    const startsAt = b.allDay ? localToUtcIso(b.startDate, "00:00", tz) : localToUtcIso(b.startDate, b.startTime!, tz);
    const endsAt = b.allDay ? localToUtcIso(addDaysKey(b.endDate, 1), "00:00", tz) : localToUtcIso(b.endDate, b.endTime!, tz);
    const { error } = await ctx.supabase.from("time_blocks").insert({
      business_id: ctx.business.id,
      professional_id: b.professionalId && z.uuid().safeParse(b.professionalId).success ? b.professionalId : null,
      kind: b.kind,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: b.allDay,
      reason: b.reason || null,
      created_by: ctx.userId,
    });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, message: "Bloqueio criado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function deleteBlockAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin();
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Bloqueio inválido." };
    const { error } = await ctx.supabase.from("time_blocks").delete().eq("id", id).eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, message: "Bloqueio removido." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

const specialSchema = z
  .object({
    professionalId: z.uuid(),
    day: dateKeySchema,
    isClosed: z.boolean(),
    open: optTime,
    close: optTime,
    breakStart: optTime,
    breakEnd: optTime,
    note: z.string().trim().max(200).optional().default(""),
  })
  .superRefine((d, ctx) => {
    if (d.isClosed) return;
    if (!d.open || !d.close || d.close <= d.open) ctx.addIssue({ code: "custom", message: "Informe abertura e fechamento válidos" });
    if ((d.breakStart && !d.breakEnd) || (!d.breakStart && d.breakEnd) || (d.breakStart && d.breakEnd && d.breakEnd <= d.breakStart))
      ctx.addIssue({ code: "custom", message: "Intervalo inválido" });
  });

export async function saveSpecialDayAction(input: unknown): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const parsed = specialSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const d = parsed.data;
    const { error } = await ctx.supabase.from("special_days").upsert(
      {
        business_id: ctx.business.id,
        professional_id: d.professionalId,
        day: d.day,
        is_closed: d.isClosed,
        open_time: d.isClosed ? null : d.open,
        close_time: d.isClosed ? null : d.close,
        break_start: d.isClosed ? null : d.breakStart,
        break_end: d.isClosed ? null : d.breakEnd,
        note: d.note || null,
      },
      { onConflict: "professional_id,day" },
    );
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true, message: "Horário especial salvo." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao salvar." };
  }
}

export async function deleteSpecialDayAction(id: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "Registro inválido." };
    const { error } = await ctx.supabase.from("special_days").delete().eq("id", id).eq("business_id", ctx.business.id);
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    refresh();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
