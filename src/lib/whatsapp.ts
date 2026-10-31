import { renderTemplate, type Templates } from "@/lib/templates";

export type WhatsTemplate = "confirmacao" | "lembrete" | "cancelamento" | "reagendamento" | "personalizada";

export const TEMPLATE_LABEL: Record<WhatsTemplate, string> = {
  confirmacao: "Enviar confirmação",
  lembrete: "Enviar lembrete",
  cancelamento: "Avisar cancelamento",
  reagendamento: "Avisar reagendamento",
  personalizada: "Enviar mensagem",
};

export interface TemplateData {
  nome: string;
  servico?: string;
  startsAt?: string;
  tz?: string;
  empresa: string;
  linkGerenciar?: string;
}

export function buildMessage(template: WhatsTemplate, d: TemplateData, custom?: Templates | null): string {
  if (template === "personalizada") return `Olá, ${d.nome.trim().split(/\s+/)[0]}! ✨`;
  return renderTemplate(template, { nome: d.nome, servico: d.servico, startsAt: d.startsAt, tz: d.tz, empresa: d.empresa, link: d.linkGerenciar }, custom);
}

/** Link oficial wa.me. Apenas abre a conversa; o envio é feito manualmente. */
export function whatsappLink(phoneE164: string, message?: string) {
  const digits = phoneE164.replace(/\D/g, "");
  return message ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : `https://wa.me/${digits}`;
}

/** Compartilhar um texto pelo WhatsApp (a pessoa escolhe o contato). */
export function whatsappShareLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
