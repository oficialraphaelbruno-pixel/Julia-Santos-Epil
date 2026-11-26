"use server";

import { z } from "zod";
import { getPublicBusiness } from "@/lib/public-data";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";
import { suggestEmailFix } from "@/lib/email-typos";

const schema = z.object({
  slug: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().pipe(z.email("Confira o e-mail")).pipe(z.string().max(254)),
  source: z.enum(["site", "faq", "assistente"]),
  // campo invisível: pessoas não preenchem, robôs sim
  website: z.string().max(0).optional().default(""),
});

export type SubscribeResult = { ok: true; message: string } | { ok: false; error: string; suggestion?: string };

/** "Fique por dentro das promoções": grava o e-mail com a data do aceite (LGPD). */
export async function subscribeNewsletterAction(input: z.input<typeof schema>, confirmedSuggestion = false): Promise<SubscribeResult> {
  const p = schema.safeParse(input);
  if (!p.success) {
    if (p.error.issues.some((i) => i.path[0] === "website")) return { ok: true, message: "Prontinho! 💛" };
    return { ok: false, error: "Confira o e-mail digitado." };
  }
  const { slug, email, source } = p.data;
  const fix = suggestEmailFix(email);
  if (fix && !confirmedSuggestion) return { ok: false, error: `Você quis dizer ${fix}?`, suggestion: fix };
  if (!(await checkRateLimit("novidades", 6, 600))) return { ok: false, error: "Muitas tentativas. Tente de novo em alguns minutos." };
  const business = await getPublicBusiness(slug);
  if (!business) return { ok: false, error: "Não foi possível concluir agora." };
  const { error } = await createServiceClient().rpc("subscribe_newsletter", { p_business_id: business.id, p_email: email, p_source: source });
  if (error) return { ok: false, error: error.message.includes("EMAIL_INVALIDO") ? "Confira o e-mail digitado." : "Não foi possível concluir agora. Tente de novo." };
  return { ok: true, message: "Prontinho! Você vai receber as novidades e promoções por e-mail. 💛" };
}
