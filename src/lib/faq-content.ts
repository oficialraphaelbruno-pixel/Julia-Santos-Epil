/**
 * Conteúdo do FAQ e conhecimento da assistente.
 * Regra do projeto: nada é inventado. As respostas automáticas são montadas
 * só com o que está cadastrado no painel (serviços, regras do agendamento,
 * endereço); o resto vem das perguntas escritas pela dona.
 */
import { formatDuration, formatMoney } from "@/lib/format";
import { formatPixKey, PIX_KEY_TYPE_LABEL } from "@/lib/pix";
import { businessAddress, type AddressFields } from "@/lib/address";

export const FAQ_CATEGORIES = [
  { key: "pre", label: "Antes da epilação", short: "Antes" },
  { key: "pos", label: "Depois da epilação", short: "Depois" },
  { key: "pagamento", label: "Pagamento e sinal", short: "Pagamento" },
  { key: "agendamento", label: "Agendamento, cancelamento e remarcação", short: "Agendamento" },
  { key: "outros", label: "Outras dúvidas", short: "Outras" },
] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number]["key"];
export const FAQ_CATEGORY_LABEL: Record<FaqCategory, string> = Object.fromEntries(FAQ_CATEGORIES.map((c) => [c.key, c.label])) as Record<
  FaqCategory,
  string
>;

export interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  sort_order: number;
  published: boolean;
}

export interface FaqService {
  name: string;
  price_cents: number;
  duration_minutes: number;
  description: string | null;
  pre_care_text: string | null;
  post_care_text: string | null;
}

export interface FaqSettings {
  online_enabled: boolean;
  deposit_enabled: boolean;
  deposit_percent: number;
  deposit_deadline_hours: number;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_holder_name: string | null;
  pix_bank: string | null;
  deposit_instructions: string | null;
  cancellation_policy: string | null;
  allow_client_cancel: boolean;
  cancel_min_hours: number;
  allow_client_reschedule: boolean;
  reschedule_min_hours: number;
}

export interface FaqBusiness extends AddressFields {
  name: string;
  whatsapp_phone: string | null;
  instagram_url: string | null;
  business_hours_note: string | null;
  maps_url: string | null;
}

/** Resposta automática: gerada dos dados do painel (a dona edita na tela indicada em `source`). */
export interface AutoAnswer {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  source: string;
}

export function instagramHandle(url: string | null | undefined) {
  if (!url) return null;
  const h = url.replace(/[?#].*$/, "").replace(/\/$/, "").split("/").pop();
  return h ? `@${h.replace(/^@/, "")}` : null;
}

export function autoAnswers(business: FaqBusiness, settings: FaqSettings | null): AutoAnswer[] {
  const out: AutoAnswer[] = [];
  if (settings) {
    if (settings.deposit_enabled) {
      const parts = [
        `Para garantir o seu horário, é pedido um sinal de ${settings.deposit_percent}% do valor do serviço, pago por Pix.`,
        `Depois de agendar, o horário fica reservado por até ${settings.deposit_deadline_hours}h aguardando o pagamento do sinal.`,
        "O sinal faz parte do valor do atendimento. A chave Pix e os dados para pagamento aparecem no final do agendamento e no e-mail de confirmação.",
      ];
      if (settings.deposit_instructions?.trim()) parts.push(settings.deposit_instructions.trim());
      out.push({ id: "auto-sinal", category: "pagamento", question: "Como funciona o pagamento do sinal?", answer: parts.join("\n\n"), source: "Agendamento Online" });
    } else {
      out.push({
        id: "auto-sinal",
        category: "pagamento",
        question: "Preciso pagar algo para agendar?",
        answer: "Não. O agendamento online não pede pagamento antecipado.",
        source: "Agendamento Online",
      });
    }
    if (settings.online_enabled) {
      out.push({
        id: "auto-como-agendar",
        category: "agendamento",
        question: "Como faço para agendar?",
        answer:
          "Pelo próprio site, no botão “Agendar”: escolha o serviço, a data e um horário livre, e informe nome, WhatsApp e e-mail. Não é preciso criar conta. Ao final, você recebe a confirmação por e-mail com um link para consultar, remarcar ou cancelar o seu horário.",
        source: "Agendamento Online",
      });
    }
    const policy = settings.cancellation_policy?.trim();
    const rules: string[] = [];
    if (settings.allow_client_reschedule) rules.push(`remarcar pelo link do agendamento com pelo menos ${settings.reschedule_min_hours}h de antecedência`);
    if (settings.allow_client_cancel) rules.push(`cancelar pelo link do agendamento com pelo menos ${settings.cancel_min_hours}h de antecedência`);
    if (policy || rules.length) {
      out.push({
        id: "auto-cancelamento",
        category: "agendamento",
        question: "Posso cancelar ou remarcar?",
        answer: policy || `Sim. Você pode ${rules.join(" e ")}.`,
        source: "Agendamento Online",
      });
    }
  }
  const address = businessAddress(business);
  if (address) {
    const hours = business.business_hours_note?.trim();
    out.push({
      id: "auto-endereco",
      category: "outros",
      question: "Onde fica o studio?",
      answer: `${address}${hours ? `\n\nHorários: ${hours}` : ""}`,
      source: "Configurações",
    });
  }
  return out;
}

/** Serviços com orientações de cuidados (antes/depois) cadastradas. */
export function careByService(services: FaqService[], kind: "pre" | "pos") {
  return services
    .map((s) => ({ name: s.name, text: (kind === "pre" ? s.pre_care_text : s.post_care_text)?.trim() ?? "" }))
    .filter((s) => s.text);
}

/**
 * Bloco de conhecimento da assistente: tudo o que ela pode usar para responder.
 * A chave Pix entra aqui (a dona autorizou a assistente a informá-la).
 */
export function assistantKnowledge(input: {
  business: FaqBusiness;
  settings: FaqSettings | null;
  services: FaqService[];
  faq: FaqItem[];
  extraInfo: string | null;
  siteUrl: string;
  bookingPath: string;
  referral?: { rewardLabel: string; friendLabel: string | null; validDays: number | null } | null;
}) {
  const { business, settings, services, faq } = input;
  const lines: string[] = [];
  lines.push(`# Studio\nNome: ${business.name}`);
  const address = businessAddress(business);
  if (address) lines.push(`Endereço: ${address}${business.maps_url ? ` (mapa: ${business.maps_url})` : ""}`);
  if (business.business_hours_note?.trim()) lines.push(`Horários: ${business.business_hours_note.trim()}`);
  if (business.whatsapp_phone) lines.push("WhatsApp: disponível pelo botão “Falar no WhatsApp”.");
  const ig = instagramHandle(business.instagram_url);
  if (ig) lines.push(`Instagram: ${ig}`);
  lines.push(`Agendamento online: ${settings?.online_enabled ? `${input.siteUrl}${input.bookingPath}` : "desativado no momento"}`);
  lines.push(
    "Quem já agendou consulta, remarca ou cancela pelo link recebido no e-mail de confirmação ou na página “Consultar meu agendamento” (botão \"consultar\"), informando o e-mail ou WhatsApp e o nome completo usados no agendamento.",
  );

  lines.push("\n# Serviços (preço e duração)");
  for (const s of services) {
    lines.push(`- ${s.name}: ${formatMoney(s.price_cents)}, ${formatDuration(s.duration_minutes)}${s.description ? `. ${s.description.trim()}` : ""}`);
  }

  const pre = careByService(services, "pre");
  if (pre.length) {
    lines.push("\n# Cuidados ANTES da epilação, por serviço");
    for (const c of pre) lines.push(`## ${c.name}\n${c.text}`);
  }
  const pos = careByService(services, "pos");
  if (pos.length) {
    lines.push("\n# Cuidados DEPOIS da epilação, por serviço");
    for (const c of pos) lines.push(`## ${c.name}\n${c.text}`);
  }

  if (settings) {
    lines.push("\n# Pagamento e sinal");
    if (settings.deposit_enabled) {
      lines.push(`Sinal de ${settings.deposit_percent}% do valor do serviço, por Pix. O horário fica reservado por até ${settings.deposit_deadline_hours}h aguardando o sinal. O sinal faz parte do valor do atendimento.`);
      if (settings.pix_key) {
        const type = PIX_KEY_TYPE_LABEL[settings.pix_key_type ?? ""] ?? "Pix";
        lines.push(`Chave Pix (${type}): ${formatPixKey(settings.pix_key, settings.pix_key_type)}`);
        if (settings.pix_holder_name) lines.push(`Favorecida: ${settings.pix_holder_name}`);
        if (settings.pix_bank) lines.push(`Banco: ${settings.pix_bank}`);
      }
      if (settings.deposit_instructions?.trim()) lines.push(settings.deposit_instructions.trim());
    } else {
      lines.push("O agendamento online não pede pagamento antecipado.");
    }
    lines.push("\n# Cancelamento e remarcação");
    if (settings.cancellation_policy?.trim()) lines.push(settings.cancellation_policy.trim());
    if (settings.allow_client_reschedule) lines.push(`Remarcação pelo link do agendamento com pelo menos ${settings.reschedule_min_hours}h de antecedência.`);
    if (settings.allow_client_cancel) lines.push(`Cancelamento pelo link do agendamento com pelo menos ${settings.cancel_min_hours}h de antecedência.`);
  }

  const published = faq.filter((f) => f.published);
  if (published.length) {
    lines.push("\n# Perguntas frequentes (respostas do studio)");
    for (const f of published) lines.push(`P: ${f.question.trim()}\nR: ${f.answer.trim()}`);
  }
  if (input.referral) {
    const r = input.referral;
    lines.push("\n# Programa de indicação");
    lines.push(
      `Cada cliente tem um link pessoal de indicação (o botão "indicar" gera o link: ela informa o WhatsApp e o e-mail do cadastro). A amiga indicada precisa ser cliente nova (WhatsApp e e-mail ainda não cadastrados)${r.friendLabel ? ` e ganha ${r.friendLabel} no primeiro agendamento` : ""}. Quando a amiga for atendida, quem indicou ganha ${r.rewardLabel} no próximo agendamento online, aplicado automaticamente ao agendar com o mesmo WhatsApp e e-mail do cadastro${r.validDays ? ` (válido por ${r.validDays} dias)` : ""}. Não acumula com cupom e ninguém indica a si mesma.`,
    );
  }
  if (input.extraInfo?.trim()) lines.push(`\n# Informações extras\n${input.extraInfo.trim()}`);
  return lines.join("\n");
}
