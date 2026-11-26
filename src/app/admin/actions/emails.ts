"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { friendlyDbError } from "@/lib/constants";
import type { ActionResult } from "@/lib/action";

/**
 * Tira o e-mail da lista de novidades: desmarca a autorização da cliente (se houver
 * cadastro) e encerra a inscrição feita pelo site. O cadastro e o histórico continuam.
 */
export async function removeFromEmailListAction(email: string): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const p = z.string().trim().toLowerCase().pipe(z.email()).safeParse(email);
    if (!p.success) return { ok: false, error: "E-mail inválido." };
    // ilike sem curingas: "_" e "%" do e-mail são tratados como texto
    const value = p.data.replace(/[\\%_]/g, (m) => `\\${m}`);
    const [c, s] = await Promise.all([
      ctx.supabase.from("clients").update({ marketing_consent: false }).eq("business_id", ctx.business.id).ilike("email", value),
      ctx.supabase
        .from("newsletter_subscribers")
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq("business_id", ctx.business.id)
        .ilike("email", value)
        .is("unsubscribed_at", null),
    ]);
    const error = c.error ?? s.error;
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    revalidatePath("/admin/emails");
    return { ok: true, message: "E-mail removido da lista de novidades." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
