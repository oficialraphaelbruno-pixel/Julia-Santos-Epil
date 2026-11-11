import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/env";
import { cleanCouponCode } from "@/lib/coupon-code";

/**
 * Link curto de divulgação: /cupom/VIRILHA30 → agendamento com o cupom.
 * Mantém parâmetros extras (ex.: utm_source de campanhas de tráfego).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const url = request.nextUrl.clone();
  url.pathname = `/agendar/${DEFAULT_BUSINESS_SLUG}`;
  const code = cleanCouponCode(decodeURIComponent(codigo));
  if (code) url.searchParams.set("cupom", code);
  return NextResponse.redirect(url, 307);
}
