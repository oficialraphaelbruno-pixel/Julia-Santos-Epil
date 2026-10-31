import { NextResponse } from "next/server";
import { getBookingByToken } from "@/lib/manage-booking";
import { buildIcs } from "@/lib/ics";
import { businessAddress } from "@/lib/public-data";
import { SITE_URL } from "@/lib/env";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBookingByToken(token);
  if (!b) return new NextResponse("Agendamento não encontrado.", { status: 404 });
  const ics = buildIcs({
    uid: `${b.id}@studio-manager`,
    title: `${b.service_name} — ${b.business.name}`,
    description: `Referência: ${b.reference_code}\nGerenciar: ${SITE_URL}/agendamento/${token}`,
    location: businessAddress(b.business),
    startsAt: b.starts_at,
    endsAt: b.ends_at,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="agendamento-${b.reference_code}.ics"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
