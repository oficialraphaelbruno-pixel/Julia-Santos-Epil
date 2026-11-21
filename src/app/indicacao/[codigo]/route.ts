import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/env";
import { cleanReferralCode } from "@/lib/coupon-code";

/** Link de indicação: /indicacao/MARIA7K2 → agendamento com a indicação registrada. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const url = request.nextUrl.clone();
  url.pathname = `/agendar/${DEFAULT_BUSINESS_SLUG}`;
  const code = cleanReferralCode(decodeURIComponent(codigo));
  if (code) url.searchParams.set("indicacao", code);
  return NextResponse.redirect(url, 307);
}
