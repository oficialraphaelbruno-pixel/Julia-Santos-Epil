import "server-only";

/**
 * WhatsApp Business Cloud API (oficial da Meta) — OPCIONAL.
 * Mensagens iniciadas pela empresa exigem modelos (templates) aprovados pela Meta.
 * Variáveis: WHATSAPP_CLOUD_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID e o nome de cada modelo.
 */
export function whatsappCloudConfig() {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN ?? "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  const missing = [!token && "WHATSAPP_CLOUD_API_TOKEN", !phoneNumberId && "WHATSAPP_PHONE_NUMBER_ID"].filter(Boolean) as string[];
  return {
    configured: missing.length === 0,
    missing,
    token,
    phoneNumberId,
    language: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "pt_BR",
    templates: {
      confirmacao: process.env.WHATSAPP_TEMPLATE_CONFIRMACAO ?? "",
      lembrete: process.env.WHATSAPP_TEMPLATE_LEMBRETE ?? "",
      cancelamento: process.env.WHATSAPP_TEMPLATE_CANCELAMENTO ?? "",
      reagendamento: process.env.WHATSAPP_TEMPLATE_REAGENDAMENTO ?? "",
      recebido: process.env.WHATSAPP_TEMPLATE_RECEBIDO ?? "",
    } as Record<string, string>,
  };
}

/** Envia um modelo aprovado. Parâmetros do corpo: nome, serviço, data, horário. */
export async function sendWhatsappTemplate(to: string, templateKey: string, params: string[]) {
  const c = whatsappCloudConfig();
  const name = c.templates[templateKey];
  if (!c.configured || !name) return { ok: false as const, skipped: true, error: "WhatsApp API não configurada para este modelo" };
  const res = await fetch(`https://graph.facebook.com/v21.0/${c.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name,
        language: { code: c.language },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) return { ok: false as const, skipped: false, error: json.error?.message ?? `HTTP ${res.status}` };
  return { ok: true as const, id: json.messages?.[0]?.id ?? "" };
}
