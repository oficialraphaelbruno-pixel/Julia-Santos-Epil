/**
 * Lógica da integração Google Agenda com respostas SIMULADAS (fetch e banco falsos).
 * Isto NÃO comprova a conexão real com o Google — só o comportamento do código.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const row: Record<string, unknown> = {};
vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        update: () => q,
        upsert: async () => ({ error: null }),
        delete: () => q,
        maybeSingle: async () => ({ data: row.conn ?? null }),
      };
      return q;
    },
  }),
}));

process.env.INTEGRATIONS_ENCRYPTION_KEY = "k".repeat(40);
process.env.GOOGLE_CLIENT_ID = "client-id-teste";
process.env.GOOGLE_CLIENT_SECRET = "segredo-teste";

const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
const g = await import("@/lib/google-calendar");

describe("criptografia de tokens", () => {
  it("cifra e decifra (AES-256-GCM), sem expor o texto", () => {
    const enc = encryptSecret("refresh-token-123");
    expect(enc).not.toContain("refresh-token-123");
    expect(decryptSecret(enc)).toBe("refresh-token-123");
  });
  it("detecta adulteração", () => {
    const enc = encryptSecret("abc");
    const parts = enc.split(".");
    parts[3] = Buffer.from("xyz").toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
});

describe("OAuth", () => {
  it("pede acesso offline com escopos mínimos e state", () => {
    const url = new URL(g.buildAuthUrl("estado123"));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("state")).toBe("estado123");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.get("scope")).not.toContain("auth/calendar ");
    expect(url.searchParams.get("redirect_uri")).toMatch(/\/api\/integracoes\/google\/callback$/);
  });
});

describe("ocupação na agenda externa (simulada)", () => {
  beforeEach(() => {
    row.conn = { business_id: "b", calendar_id: "primary", refresh_token_encrypted: encryptSecret("rt"), status: "connected" };
  });

  it("ignora eventos do próprio sistema e eventos 'disponível'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "at" }));
        return new Response(
          JSON.stringify({
            items: [
              { status: "confirmed", start: { dateTime: "2026-11-10T13:00:00Z" }, end: { dateTime: "2026-11-10T14:00:00Z" } },
              { status: "confirmed", transparency: "transparent", start: { dateTime: "2026-11-10T15:00:00Z" }, end: { dateTime: "2026-11-10T16:00:00Z" } },
              {
                status: "confirmed",
                start: { dateTime: "2026-11-10T17:00:00Z" },
                end: { dateTime: "2026-11-10T18:00:00Z" },
                extendedProperties: { private: { studioManagerAppointmentId: "x" } },
              },
            ],
          }),
        );
      }),
    );
    const r = await g.getBusyIntervals("b", "2026-11-10T00:00:00Z", "2026-11-11T00:00:00Z");
    expect(r).toMatchObject({ connected: true, ok: true });
    expect(r.intervals).toHaveLength(1);
    expect(g.overlapsBusy(r.intervals, Date.parse("2026-11-10T13:30:00Z"), Date.parse("2026-11-10T14:30:00Z"))).toBe(true);
    expect(g.overlapsBusy(r.intervals, Date.parse("2026-11-10T14:00:00Z"), Date.parse("2026-11-10T15:00:00Z"))).toBe(false);
  });

  it("falha da API não é tratada como 'livre verificado'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })));
    const r = await g.getBusyIntervals("b", "2026-11-10T00:00:00Z", "2026-11-11T00:00:00Z");
    expect(r).toMatchObject({ connected: true, ok: false });
  });

  it("sem conexão: nada a verificar", async () => {
    row.conn = null;
    const r = await g.getBusyIntervals("b", "a", "b");
    expect(r).toMatchObject({ connected: false, ok: true });
  });
});
