import { formatDate, formatTime } from "@/lib/format";

export type TemplateKey = "confirmacao" | "lembrete" | "cancelamento" | "reagendamento" | "recebido" | "sinal" | "orientacoes_pre" | "orientacoes_pos";

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  recebido: "Agendamento recebido (aguardando confirmação)",
  confirmacao: "Confirmação",
  lembrete: "Lembrete",
  cancelamento: "Cancelamento",
  reagendamento: "Reagendamento",
  sinal: "Cobrança do sinal (Pix)",
  orientacoes_pre: "Orientações pré-procedimento",
  orientacoes_pos: "Orientações pós-procedimento",
};

/** Modelos padrão. Variáveis: {nome} {servico} {data} {horario} {empresa} {link} {sinal} {pix} {orientacoes} */
export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  confirmacao:
    "Olá, {nome}! ✨\nSeu agendamento na {empresa} foi confirmado!\nServiço: {servico}\nData: {data}\nHorário: {horario}\nEsperamos por você! 💛",
  lembrete:
    "Olá, {nome}! 💛\nPassando para lembrar do seu atendimento na {empresa}.\nServiço: {servico}\nData: {data}\nHorário: {horario}\nAté breve! ✨",
  cancelamento:
    "Olá, {nome}!\nSeu agendamento na {empresa} foi cancelado.\nServiço: {servico}\nData: {data}\nHorário: {horario}\nQuando quiser, é só agendar um novo horário. 💛",
  reagendamento:
    "Olá, {nome}! ✨\nSeu agendamento na {empresa} foi reagendado.\nServiço: {servico}\nNova data: {data}\nNovo horário: {horario}\nEsperamos por você! 💛",
  recebido:
    "Olá, {nome}! ✨\nRecebemos seu pedido de agendamento na {empresa}.\nServiço: {servico}\nData: {data}\nHorário: {horario}\nEm breve confirmaremos seu horário. 💛",
  sinal:
    "Olá, {nome}! ✨\nSeu horário na {empresa} está reservado:\nServiço: {servico}\nData: {data}\nHorário: {horario}\n\nPara confirmar, envie o sinal de {sinal} via Pix:\n{pix}\n\nDepois é só mandar o comprovante por aqui. 💛",
  orientacoes_pre:
    "Olá, {nome}! 💛\nSeguem as orientações para o seu atendimento de {servico} em {data} às {horario}:\n\n{orientacoes}\n\nQualquer dúvida, estou por aqui. ✨",
  orientacoes_pos:
    "Olá, {nome}! ✨\nObrigada pela visita à {empresa}! Seguem os cuidados após o seu atendimento de {servico}:\n\n{orientacoes}\n\nQualquer dúvida, é só chamar. 💛",
};

export type Templates = Partial<Record<TemplateKey, string>>;

export interface RenderData {
  nome: string;
  servico?: string;
  startsAt?: string;
  tz?: string;
  empresa: string;
  link?: string;
  sinal?: string;
  pix?: string;
  orientacoes?: string;
}

export function renderTemplate(key: TemplateKey, data: RenderData, custom?: Templates | null) {
  const tpl = (custom?.[key] && custom[key]!.trim()) || DEFAULT_TEMPLATES[key];
  const vars: Record<string, string> = {
    nome: data.nome.trim().split(/\s+/)[0] ?? data.nome,
    servico: data.servico ?? "",
    data: data.startsAt ? formatDate(data.startsAt, data.tz) : "",
    horario: data.startsAt ? formatTime(data.startsAt, data.tz) : "",
    empresa: data.empresa,
    link: data.link ?? "",
    sinal: data.sinal ?? "",
    pix: data.pix ?? "",
    orientacoes: data.orientacoes ?? "",
  };
  return tpl.replace(/\{(nome|servico|data|horario|empresa|link|sinal|pix|orientacoes)\}/g, (_, k: string) => vars[k] ?? "");
}
