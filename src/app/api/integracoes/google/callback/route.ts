import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAdminContext } from "@/lib/auth";
import { exchangeCode, saveConnection } from "@/lib/google-calendar";
import { SITE_URL } from "@/lib/env";

function back(status: string) {
  const res = NextResponse.redirect(`${SITE_URL}/admin/integracoes?google=${status}`);
  res.cookies.delete({ name: "g_oauth_state", path: "/api/integracoes/google" });
  return res;
}

/** Retorno do OAuth: valida o "state" (proteção CSRF), troca o código e guarda o token criptografado. */
export async function GET(req: NextRequest) {
  const ctx = await getAdminContext();
  if (!ctx || ctx.role !== "owner") return NextResponse.redirect(`${SITE_URL}/admin/login`);
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back("recusado");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const [cookieState, businessId] = (req.cookies.get("g_oauth_state")?.value ?? "").split(".");
  const valid =
    code &&
    cookieState &&
    state.length === cookieState.length &&
    timingSafeEqual(Buffer.from(state), Buffer.from(cookieState)) &&
    businessId === ctx.business.id;
  if (!valid) return back("estado-invalido");
  try {
    const t = await exchangeCode(code!);
    if (!t.refreshToken) return back("sem-token");
    await saveConnection(ctx.business.id, ctx.userId, { refreshToken: t.refreshToken, email: t.email, scope: t.scope });
    return back("conectado");
  } catch {
    return back("erro");
  }
}
