export type AppointmentStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  in_progress: "Em atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export const STATUS_STYLE: Record<AppointmentStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  in_progress: "bg-sky-50 text-sky-800 ring-sky-200",
  completed: "bg-stone-100 text-stone-700 ring-stone-200",
  cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
  no_show: "bg-zinc-100 text-zinc-600 ring-zinc-300",
};

export const STATUS_DOT: Record<AppointmentStatus, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-emerald-500",
  in_progress: "bg-sky-500",
  completed: "bg-stone-400",
  cancelled: "bg-rose-400",
  no_show: "bg-zinc-400",
};

export const PAYMENT_METHOD_LABEL = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  outros: "Outros",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHOD_LABEL;

export const BLOCK_KIND_LABEL = {
  bloqueio: "Bloqueio",
  ferias: "Férias",
  feriado: "Feriado",
  pessoal: "Compromisso pessoal",
} as const;
export type BlockKind = keyof typeof BLOCK_KIND_LABEL;

/** Mensagens amigáveis para os códigos de erro do banco. */
export const DB_ERROR_MESSAGES: Record<string, string> = {
  HORARIO_INDISPONIVEL: "Esse horário acabou de ficar indisponível. Escolha outro, por favor.",
  AGENDAMENTO_DESATIVADO: "O agendamento online está temporariamente desativado.",
  SERVICO_INDISPONIVEL: "Este serviço não está disponível para agendamento.",
  LIMITE_DE_AGENDAMENTOS: "Você já possui agendamentos ativos. Para novos horários, fale conosco pelo WhatsApp.",
  NAO_ENCONTRADO: "Agendamento não encontrado.",
  STATUS_NAO_PERMITE: "Este agendamento não pode mais ser alterado.",
  CANCELAMENTO_DESATIVADO: "O cancelamento online não está disponível. Fale conosco pelo WhatsApp.",
  REAGENDAMENTO_DESATIVADO: "O reagendamento online não está disponível. Fale conosco pelo WhatsApp.",
  PRAZO_ENCERRADO: "O prazo para alterar este agendamento online já terminou. Fale conosco pelo WhatsApp.",
  CONFLITO: "Já existe um atendimento nesse horário para esta profissional.",
  FECHADO: "O studio está fechado nesse dia.",
  FORA_DO_HORARIO: "O horário está fora do expediente configurado.",
  INTERVALO: "O horário coincide com o intervalo (almoço).",
  BLOQUEIO: "O horário coincide com um bloqueio da agenda.",
  CLIENTE_NAO_ENCONTRADA: "Cliente não encontrada.",
  PROFISSIONAL_INVALIDO: "Profissional inválida.",
  SEM_PERMISSAO: "Você não tem permissão para esta ação.",
  CUPOM_INVALIDO: "Cupom inválido ou inativo.",
  CUPOM_EXPIRADO: "Este cupom está fora do período de validade.",
  CUPOM_ESGOTADO: "Este cupom já atingiu o limite de usos.",
  CUPOM_JA_UTILIZADO: "Você já utilizou este cupom.",
  CUPOM_NAO_APLICAVEL: "Este cupom não vale para o serviço escolhido.",
  CUPOM_VALOR_MINIMO: "O serviço escolhido não atinge o valor mínimo do cupom.",
};

export function friendlyDbError(message: string | undefined | null, fallback = "Não foi possível concluir. Tente novamente.") {
  if (!message) return fallback;
  for (const [code, text] of Object.entries(DB_ERROR_MESSAGES)) {
    if (message.includes(code)) return text;
  }
  if (message.includes("duplicate key") && message.includes("phone")) return "Já existe uma cliente com este WhatsApp.";
  if (message.includes("row-level security") || message.includes("permission denied")) return "Você não tem permissão para esta ação.";
  return fallback;
}
