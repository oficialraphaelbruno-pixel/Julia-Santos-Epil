import { describe, expect, it } from "vitest";
import { assistantKnowledge, autoAnswers, careByService, instagramHandle, type FaqBusiness, type FaqSettings } from "@/lib/faq-content";
import { buildSystemPrompt, parseMelReply, sanitizeHistory } from "@/lib/mel-prompt";
import { contactsToResendCsv, filterContacts, type EmailContact } from "@/lib/email-list";

const business: FaqBusiness = {
  name: "Julia Santos Epil",
  whatsapp_phone: "5531999990000",
  instagram_url: "https://www.instagram.com/julia.santos_epil/",
  business_hours_note: null,
  maps_url: null,
  address_line: "Rua Bom Pastor, 447",
  address_district: "São Benedito",
  address_city: "Santa Luzia",
  address_state: "MG",
  address_zip: null,
};
const settings: FaqSettings = {
  online_enabled: true,
  deposit_enabled: true,
  deposit_percent: 50,
  deposit_deadline_hours: 24,
  pix_key: "+5531999990000",
  pix_key_type: "telefone",
  pix_holder_name: "Julia Santos",
  pix_bank: "Banco Itaú S.A.",
  deposit_instructions: null,
  cancellation_policy: "Texto da política da Julia.",
  allow_client_cancel: true,
  cancel_min_hours: 12,
  allow_client_reschedule: true,
  reschedule_min_hours: 12,
};
const services = [
  { name: "Axilas", price_cents: 4000, duration_minutes: 30, description: null, pre_care_text: "Não usar desodorante.", post_care_text: "Evitar sol." },
  { name: "Buço", price_cents: 2500, duration_minutes: 15, description: null, pre_care_text: null, post_care_text: "  " },
];

describe("FAQ automático (só dados do painel)", () => {
  it("monta sinal, agendamento, cancelamento e endereço a partir do cadastro", () => {
    const a = autoAnswers(business, settings);
    const sinal = a.find((x) => x.id === "auto-sinal")!;
    expect(sinal.answer).toContain("50%");
    expect(sinal.answer).toContain("24h");
    expect(sinal.answer).not.toContain("99999"); // a chave Pix não vai para a página pública
    expect(a.find((x) => x.id === "auto-cancelamento")!.answer).toBe("Texto da política da Julia.");
    expect(a.find((x) => x.id === "auto-endereco")!.answer).toContain("Rua Bom Pastor, 447");
  });
  it("sem sinal configurado, não fala em sinal", () => {
    const a = autoAnswers(business, { ...settings, deposit_enabled: false });
    expect(a.find((x) => x.id === "auto-sinal")!.answer).toContain("não pede pagamento antecipado");
  });
  it("cuidados por serviço ignoram textos vazios", () => {
    expect(careByService(services, "pre").map((s) => s.name)).toEqual(["Axilas"]);
    expect(careByService(services, "pos").map((s) => s.name)).toEqual(["Axilas"]);
  });
  it("arroba do Instagram", () => {
    expect(instagramHandle("https://www.instagram.com/julia.santos_epil/")).toBe("@julia.santos_epil");
    expect(instagramHandle(null)).toBeNull();
  });
});

describe("Conhecimento e instruções da assistente", () => {
  it("inclui preços, cuidados, Pix e o FAQ publicado (e não o escondido)", () => {
    const k = assistantKnowledge({
      business,
      settings,
      services,
      faq: [
        { id: "1", category: "outros", question: "Atende aos sábados?", answer: "Sim, com hora marcada.", sort_order: 1, published: true },
        { id: "2", category: "outros", question: "Pergunta escondida", answer: "Não mostrar", sort_order: 2, published: false },
      ],
      extraInfo: "Aceita cartão no dia.",
      siteUrl: "https://exemplo.com.br",
      bookingPath: "/agendar/julia",
    });
    expect(k).toContain("Axilas: R$");
    expect(k).toContain("Não usar desodorante.");
    expect(k).toContain("Chave Pix (Celular): (31) 99999-0000");
    expect(k).toContain("Atende aos sábados?");
    expect(k).not.toContain("Pergunta escondida");
    expect(k).toContain("Aceita cartão no dia.");
  });
  it("as regras fixas estão sempre no prompt", () => {
    const p = buildSystemPrompt({ name: "Mel", businessName: "Julia Santos Epil", ownerFirstName: "Julia", personality: null, avoidTopics: null, knowledge: "DADOS", today: "hoje" });
    expect(p).toContain("Nunca invente preços");
    expect(p).toContain("não dê diagnóstico");
    expect(p).toContain("DADOS");
  });
  it("lê JSON, bloco de código e texto solto; filtra ações desconhecidas", () => {
    expect(parseMelReply('{"resposta":"Oi!","respondeu":true,"acoes":["agendar","hackear"]}')).toEqual({ answer: "Oi!", answered: true, actions: ["agendar"] });
    expect(parseMelReply('```json\n{"resposta":"Não sei","respondeu":false,"acoes":["whatsapp"]}\n```')).toEqual({ answer: "Não sei", answered: false, actions: ["whatsapp"] });
    expect(parseMelReply("Só texto")?.answer).toBe("Só texto");
    expect(parseMelReply("")).toBeNull();
  });
  it("histórico: só papéis válidos, últimas 8 mensagens", () => {
    const h = sanitizeHistory([...Array(12)].map((_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` })).concat([{ role: "system", content: "x" } as never]));
    expect(h).toHaveLength(8);
    expect(h.every((t) => t.role === "user" || t.role === "assistant")).toBe(true);
    expect(sanitizeHistory("lixo")).toEqual([]);
  });
});

describe("Lista de e-mails", () => {
  const base: EmailContact = { email: "ana@x.com", name: "Ana Paula Souza", clientId: "c1", subscriberId: null, origins: ["agendamento"], status: "atendida", lastVisit: "2026-01-10T12:00:00Z", birthday: "1990-12-05", services: ["Axilas"], since: "2026-01-01" };
  const rows: EmailContact[] = [base, { ...base, email: "bia@x.com", name: null, clientId: null, origins: ["site"], status: "nunca", lastVisit: null, birthday: null, services: [] }];
  const now = Date.parse("2026-11-26T12:00:00Z");
  it("filtra por origem, situação, serviço, sumidas e aniversário", () => {
    expect(filterContacts(rows, { origem: "site" }, now).map((r) => r.email)).toEqual(["bia@x.com"]);
    expect(filterContacts(rows, { situacao: "atendida" }, now)).toHaveLength(1);
    expect(filterContacts(rows, { servico: "Axilas" }, now)).toHaveLength(1);
    expect(filterContacts(rows, { inativas: "1" }, now)).toHaveLength(1);
    expect(filterContacts(rows, { aniversario: "12" }, now)).toHaveLength(1);
    expect(filterContacts(rows, { q: "BIA" }, now)).toHaveLength(1);
  });
  it("CSV no formato do Resend", () => {
    const csv = contactsToResendCsv(rows);
    expect(csv.split("\n")[0]).toBe("email,first_name,last_name,origem,situacao");
    expect(csv).toContain("ana@x.com,Ana,Paula Souza,Agendamento,Já foi atendida");
  });
});
