import { formatDate, formatTime } from "@/lib/format";

export type TemplateKey = "confirmacao" | "lembrete" | "cancelamento" | "reagendamento" | "recebido";

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  recebido: "Agendamento recebido (aguardando confirmação)",
  confirmacao: "Confirmação",
  lembrete: "Lembrete",
  cancelamento: "Cancelamento",
  reagendamento: "Reagendamento",
};

/** Modelos padrão (textos oficiais do studio). Variáveis: {nome} {servico} {data} {horario} {empresa} {link} */
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
};

export type Templates = Partial<Record<TemplateKey, string>>;

export interface RenderData {
  nome: string;
  servico?: string;
  startsAt?: string;
  tz?: string;
  empresa: string;
  link?: string;
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
  };
  return tpl.replace(/\{(nome|servico|data|horario|empresa|link)\}/g, (_, k: string) => vars[k] ?? "");
}
