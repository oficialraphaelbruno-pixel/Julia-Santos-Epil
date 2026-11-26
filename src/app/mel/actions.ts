"use server";

import { z } from "zod";
import { getPublicBusiness } from "@/lib/public-data";
import { getFaqData, openaiConfigured } from "@/lib/faq-data";
import { assistantKnowledge } from "@/lib/faq-content";
import { buildSystemPrompt, MEL_MAX_MESSAGE, parseMelReply, sanitizeHistory, type MelReply } from "@/lib/mel-prompt";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/admin";
import { formatLongDate, localToUtcIso, todayKey } from "@/lib/format";
import { SITE_URL } from "@/lib/env";

const inputSchema = z.object({
  slug: z.string().trim().min(1).max(60),
  message: z.string().trim().min(1, "Escreva sua dúvida").max(MEL_MAX_MESSAGE, "Mensagem muito longa"),
  history: z.unknown(),
});

export type MelResult = { ok: true; reply: MelReply } | { ok: false; error: string; reply?: MelReply };

const OOPS: MelReply = {
  answer: "Ai, tive um probleminha para responder agora 🙈 Pode tentar de novo daqui a pouquinho ou falar direto com a gente no WhatsApp?",
  answered: false,
  actions: ["whatsapp"],
};

/** Remove números longos e e-mails antes de guardar a pergunta (não precisamos de dados pessoais no registro). */
function maskPersonal(text: string) {
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[e-mail]")
    .replace(/(?:\d[\s.\-()]*){8,}/g, "[número]")
    .slice(0, 600);
}

async function callOpenAI(model: string, system: string, history: { role: string; content: string }[], message: string) {
  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, ...history, { role: "user", content: message }],
        response_format: { type: "json_object" },
        max_completion_tokens: 450,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[mel] OpenAI respondeu ${res.status}: ${body.slice(0, 300)}`);
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("[mel] falha ao chamar a OpenAI:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function askMelAction(input: z.input<typeof inputSchema>): Promise<MelResult> {
  const p = inputSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Mensagem inválida." };
  const { slug, message } = p.data;
  const history = sanitizeHistory(p.data.history);

  if (!(await checkRateLimit("mel-minuto", 8, 60)) || !(await checkRateLimit("mel", 40, 3600))) {
    return { ok: false, error: "Você mandou muitas mensagens seguidas. Respira um pouquinho e tenta de novo daqui a alguns minutos 💛" };
  }
  const business = await getPublicBusiness(slug);
  if (!business) return { ok: false, error: "Assistente indisponível no momento." };
  const data = await getFaqData(business.id);
  const assistant = data.assistant;
  if (!assistant?.enabled || !openaiConfigured()) return { ok: false, error: "Assistente indisponível no momento." };

  const db = createServiceClient();
  const tz = business.timezone;
  const dayStart = localToUtcIso(todayKey(tz), "00:00", tz);
  const { count } = await db
    .from("assistant_logs")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .gte("created_at", dayStart);
  if ((count ?? 0) >= assistant.daily_limit) {
    return {
      ok: true,
      reply: {
        answer: `Hoje eu já conversei com muita gente e estou descansando um pouquinho 🍯 Fala com a gente pelo WhatsApp que a ${business.name.split(" ")[0]} te responde, tá bom?`,
        answered: false,
        actions: ["whatsapp"],
      },
    };
  }

  const knowledge = assistantKnowledge({
    business,
    settings: data.settings,
    services: data.services,
    faq: data.faq,
    extraInfo: assistant.extra_info,
    siteUrl: SITE_URL,
    bookingPath: `/agendar/${business.slug}`,
  });
  const system = buildSystemPrompt({
    name: assistant.name,
    businessName: business.name,
    ownerFirstName: business.name.split(" ")[0],
    personality: assistant.personality,
    avoidTopics: assistant.avoid_topics,
    knowledge,
    today: formatLongDate(new Date(), tz),
  });
  const raw = await callOpenAI(assistant.model, system, history, message);
  const reply = parseMelReply(raw);
  if (!reply) return { ok: false, error: "Falha temporária.", reply: OOPS };

  await db.from("assistant_logs").insert({ business_id: business.id, question: maskPersonal(message), answered: reply.answered });
  return { ok: true, reply };
}
