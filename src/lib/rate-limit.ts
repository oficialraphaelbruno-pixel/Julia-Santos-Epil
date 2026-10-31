import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";

/** Identificador anônimo do visitante (hash do IP + segredo). O IP não é armazenado. */
export async function visitorKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
  const salt = process.env.RATE_LIMIT_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Retorna true quando a requisição está dentro do limite. Em caso de falha do banco, permite (fail-open). */
export async function checkRateLimit(scope: string, max: number, windowSeconds: number) {
  try {
    const key = await visitorKey();
    const db = createServiceClient();
    const { data, error } = await db.rpc("rate_limit_hit", {
      p_bucket: `${scope}:${key}`,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true;
    return data === true;
  } catch {
    return true;
  }
}
