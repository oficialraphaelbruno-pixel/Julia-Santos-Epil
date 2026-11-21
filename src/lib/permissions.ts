/** Áreas do painel que o administrador geral pode liberar ou bloquear para cada usuário. */
export const AREAS = [
  { key: "site", label: "Textos, imagens e dados do site", hint: "Título, “sobre”, fotos, capa, endereço e contatos (Configurações)" },
  { key: "servicos", label: "Serviços e preços", hint: "Criar, editar, mudar valores e a ordem dos serviços" },
  { key: "ofertas", label: "Ofertas (order bump)", hint: "Criar e mudar preços das ofertas" },
  { key: "cupons", label: "Cupons", hint: "Criar, editar, ativar e remover cupons" },
  { key: "indicacoes", label: "Programa de indicação", hint: "Ativar o programa e definir os descontos de quem indica e da amiga" },
  { key: "horarios", label: "Horários de funcionamento", hint: "Expediente e dias especiais/feriados (bloquear um horário continua liberado)" },
  { key: "agendamento", label: "Regras do agendamento online", hint: "Sinal, Pix, prazos e política de cancelamento" },
  { key: "legal", label: "Textos legais", hint: "Política de Privacidade e Termos de Uso" },
  { key: "integracoes", label: "Integrações", hint: "Google Agenda e WhatsApp oficial" },
  { key: "comunicacao", label: "Comunicação", hint: "Modelos de mensagens e e-mails automáticos" },
  { key: "financeiro", label: "Financeiro", hint: "Ver e lançar despesas e receitas" },
  { key: "exportar", label: "Exportar planilhas", hint: "Baixar clientes, agendamentos e financeiro" },
] as const;

export type Area = (typeof AREAS)[number]["key"];
export type Permissions = Partial<Record<Area, boolean>>;

export const AREA_LABEL: Record<Area, string> = Object.fromEntries(AREAS.map((a) => [a.key, a.label])) as Record<Area, string>;

/** Área ausente = liberada. */
export function isAllowed(perms: Permissions | null | undefined, area: Area) {
  return perms?.[area] !== false;
}
