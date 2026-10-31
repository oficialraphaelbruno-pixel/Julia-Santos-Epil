import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/auth";
import { buildAuthUrl, googleConfig } from "@/lib/google-calendar";
import { SITE_URL } from "@/lib/env";

/** Inicia o OAuth 2.0 do Google (somente proprietária). */
export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx || ctx.role !== "owner") return NextResponse.redirect(`${SITE_URL}/admin/login`);
  if (!googleConfig().configured) return NextResponse.redirect(`${SITE_URL}/admin/integracoes?google=nao-configurado`);
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("g_oauth_state", `${state}.${ctx.business.id}`, {
    httpOnly: true,
    secure: SITE_URL.startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/integracoes/google",
  });
  return res;
}
