import { formatDate, formatTime } from "@/lib/format";

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

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function buildMessage(template: WhatsTemplate, d: TemplateData): string {
  const nome = firstName(d.nome);
  const data = d.startsAt ? formatDate(d.startsAt, d.tz) : "";
  const horario = d.startsAt ? formatTime(d.startsAt, d.tz) : "";
  switch (template) {
    case "confirmacao":
      return `Olá, ${nome}! ✨\nSeu agendamento na ${d.empresa} foi confirmado!\nServiço: ${d.servico}\nData: ${data}\nHorário: ${horario}\nEsperamos por você! 💛`;
    case "lembrete":
      return `Olá, ${nome}! 💛\nPassando para lembrar do seu atendimento na ${d.empresa}.\nServiço: ${d.servico}\nData: ${data}\nHorário: ${horario}\nAté breve! ✨`;
    case "cancelamento":
      return `Olá, ${nome}!\nSeu agendamento na ${d.empresa} foi cancelado.\nServiço: ${d.servico}\nData: ${data}\nHorário: ${horario}\nQuando quiser, é só agendar um novo horário. 💛`;
    case "reagendamento":
      return `Olá, ${nome}! ✨\nSeu agendamento na ${d.empresa} foi reagendado.\nServiço: ${d.servico}\nNova data: ${data}\nNovo horário: ${horario}\nEsperamos por você! 💛`;
    case "personalizada":
    default:
      return `Olá, ${nome}! ✨`;
  }
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
