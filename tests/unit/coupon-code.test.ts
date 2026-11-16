import { describe, expect, it } from "vitest";
import { cleanCouponCode } from "@/lib/coupon-code";

describe("cleanCouponCode (link de cupom)", () => {
  it("normaliza maiúsculas e espaços", () => {
    expect(cleanCouponCode(" virilha30 ")).toBe("VIRILHA30");
    expect(cleanCouponCode("bem vinda10")).toBe("BEMVINDA10");
    expect(cleanCouponCode(["axila_15", "x"])).toBe("AXILA_15");
  });
  it("rejeita formatos inválidos", () => {
    expect(cleanCouponCode(undefined)).toBeNull();
    expect(cleanCouponCode("ab")).toBeNull();
    expect(cleanCouponCode("<script>")).toBeNull();
    expect(cleanCouponCode("a".repeat(31))).toBeNull();
  });
});

import { suggestEmailFix } from "@/lib/email-typos";
import { clientBookingSchema } from "@/lib/schemas";

describe("e-mail obrigatório no agendamento", () => {
  const base = { fullName: "Maria Silva", phone: "(31) 99999-0000", privacy: true as const };
  it("exige e-mail", () => {
    expect(clientBookingSchema.safeParse({ ...base }).success).toBe(false);
    expect(clientBookingSchema.safeParse({ ...base, email: "" }).success).toBe(false);
  });
  it("aceita e-mail válido e normaliza", () => {
    const r = clientBookingSchema.safeParse({ ...base, email: " Maria@Exemplo.com.br " });
    expect(r.success && r.data.email).toBe("maria@exemplo.com.br");
  });
  it("sugere correção de erros comuns", () => {
    expect(suggestEmailFix("ana@gmail.comc")).toBe("ana@gmail.com");
    expect(suggestEmailFix("ana@gmial.com")).toBe("ana@gmail.com");
    expect(suggestEmailFix("ana@uol.com.b")).toBe("ana@uol.com.br");
    expect(suggestEmailFix("ana@gmail.com")).toBeNull();
    expect(clientBookingSchema.safeParse({ ...base, email: "ana@hotmal.com" }).success).toBe(false);
  });
});

import { ageOn, daysUntilBirthday } from "@/lib/birthday";

describe("aniversário", () => {
  it("conta os dias até o próximo aniversário", () => {
    expect(daysUntilBirthday("1990-11-16", "2026-11-16")).toBe(0);
    expect(daysUntilBirthday("1990-11-20", "2026-11-16")).toBe(4);
    expect(daysUntilBirthday("1990-01-02", "2026-12-31")).toBe(2);
    expect(daysUntilBirthday("1992-02-29", "2027-02-27")).toBe(1);
  });
  it("calcula a idade", () => {
    expect(ageOn("1990-11-16", "2026-11-16")).toBe(36);
    expect(ageOn("1990-11-17", "2026-11-16")).toBe(35);
  });
});
