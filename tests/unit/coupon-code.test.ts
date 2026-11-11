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
