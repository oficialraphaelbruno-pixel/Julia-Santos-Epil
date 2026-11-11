import { describe, expect, it } from "vitest";
import { formatPhone, normalizeBrazilPhone } from "@/lib/phone";
import { addDaysKey, formatDate, formatDuration, formatMoney, formatTime, localToUtcIso, parseMoneyToCents, weekdayOfKey } from "@/lib/format";
import { buildMessage, whatsappLink } from "@/lib/whatsapp";
import { buildIcs, googleCalendarTemplateLink } from "@/lib/ics";
import { friendlyDbError } from "@/lib/constants";
import { clientBookingSchema } from "@/lib/schemas";

describe("telefone", () => {
  it("normaliza formatos brasileiros", () => {
    expect(normalizeBrazilPhone("(31) 99862-8886")).toBe("5531998628886");
    expect(normalizeBrazilPhone("+55 31 99862-8886")).toBe("5531998628886");
    expect(normalizeBrazilPhone("31 3333-4444")).toBe("553133334444");
  });
  it("recusa números inválidos", () => {
    expect(normalizeBrazilPhone("123")).toBeNull();
    expect(normalizeBrazilPhone("(31) 89862-8886")).toBeNull(); // celular sem 9
    expect(normalizeBrazilPhone("(01) 99862-8886")).toBeNull(); // DDD inválido
  });
  it("formata para exibição", () => {
    expect(formatPhone("5531998628886")).toBe("(31) 99862-8886");
  });
});

describe("moeda e datas (pt-BR, America/Sao_Paulo)", () => {
  it("formata reais", () => {
    expect(formatMoney(123456)).toBe("R$ 1.234,56");
    expect(formatMoney(0)).toBe("R$ 0,00");
  });
  it("converte valores digitados", () => {
    expect(parseMoneyToCents("85,00")).toBe(8500);
    expect(parseMoneyToCents("R$ 1.200,50")).toBe(120050);
    expect(parseMoneyToCents("abc")).toBeNull();
  });
  it("usa DD/MM/AAAA e 24 horas no fuso de São Paulo", () => {
    expect(formatDate("2026-11-07T12:30:00Z")).toBe("07/11/2026");
    expect(formatTime("2026-11-07T12:30:00Z")).toBe("09:30");
    expect(formatTime("2026-11-07T23:30:00Z")).toBe("20:30");
  });
  it("converte horário local em UTC", () => {
    expect(localToUtcIso("2026-11-07", "09:00")).toBe("2026-11-07T12:00:00.000Z");
  });
  it("calcula dias sem depender do fuso do servidor", () => {
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOfKey("2026-11-01")).toBe(0); // domingo
  });
  it("formata duração", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(120)).toBe("2h");
  });
});

describe("WhatsApp", () => {
  it("monta a mensagem de confirmação oficial", () => {
    const msg = buildMessage("confirmacao", {
      nome: "Maria Silva",
      servico: "Epilação",
      startsAt: "2026-11-07T12:00:00Z",
      empresa: "Julia Santos Epil",
    });
    expect(msg).toBe(
      "Olá, Maria! ✨\nSeu agendamento na Julia Santos Epil foi confirmado!\nServiço: Epilação\nData: 07/11/2026\nHorário: 09:00\nEsperamos por você! 💛",
    );
  });
  it("monta a mensagem de lembrete oficial", () => {
    const msg = buildMessage("lembrete", { nome: "Ana", servico: "X", startsAt: "2026-11-07T12:00:00Z", empresa: "Julia Santos Epil" });
    expect(msg).toContain("Passando para lembrar do seu atendimento na Julia Santos Epil.");
    expect(msg.endsWith("Até breve! ✨")).toBe(true);
  });
  it("gera link oficial wa.me", () => {
    expect(whatsappLink("5531998628886", "Olá")).toBe("https://wa.me/5531998628886?text=Ol%C3%A1");
  });
});

describe("calendário da cliente", () => {
  const ev = { uid: "AG-TESTE", title: "Serviço; teste", description: "linha 1\nlinha 2", startsAt: "2026-11-07T12:00:00Z", endsAt: "2026-11-07T13:00:00Z" };
  it("gera ICS válido com escape", () => {
    const ics = buildIcs(ev);
    expect(ics).toContain("DTSTART:20261107T120000Z");
    expect(ics).toContain("SUMMARY:Serviço\; teste");
    expect(ics).toContain("DESCRIPTION:linha 1\\nlinha 2");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
  it("gera link do Google Agenda", () => {
    expect(googleCalendarTemplateLink(ev)).toContain("dates=20261107T120000Z%2F20261107T130000Z");
  });
});

describe("validação e mensagens", () => {
  it("exige consentimento de privacidade e nome completo", () => {
    const r = clientBookingSchema.safeParse({ fullName: "Maria", phone: "31998628886", privacy: false });
    expect(r.success).toBe(false);
    const ok = clientBookingSchema.safeParse({ fullName: "Maria Silva", phone: "31998628886", privacy: true, email: "maria@exemplo.com.br" });
    expect(ok.success && ok.data.phone).toBe("5531998628886");
  });
  it("traduz erros do banco", () => {
    expect(friendlyDbError("HORARIO_INDISPONIVEL")).toMatch(/indisponível/);
    expect(friendlyDbError("new row violates row-level security policy")).toMatch(/permissão/);
  });
});

import { buildPixPayload, crc16, normalizePixKey } from "@/lib/pix";
describe("Pix copia e cola", () => {
  it("CRC16 confere com o exemplo oficial do Banco Central", () => {
    const body =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(crc16(body)).toBe("1D3D");
  });
  it("gera payload com valor, recebedor e txid", () => {
    const p = buildPixPayload({ key: "+5531998628886", name: "Julia Caroline Pereira dos Santos", amountCents: 4250, txid: "AG-ABC123" });
    expect(p).toContain("0014br.gov.bcb.pix0114+5531998628886");
    expect(p).toContain("540542.50");
    expect(p).toContain("5925JULIA CAROLINE PEREIRA D");
    expect(p).toContain("0508AGABC123");
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
  });
  it("normaliza chave de celular", () => {
    expect(normalizePixKey("31 99862-8886", "telefone")).toBe("+5531998628886");
    expect(normalizePixKey("123", "cpf")).toBeNull();
  });
});
