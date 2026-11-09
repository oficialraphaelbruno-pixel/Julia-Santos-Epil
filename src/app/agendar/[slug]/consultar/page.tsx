import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingShell } from "@/components/booking/booking-wizard";
import { ConsultBookings } from "@/components/booking/consult-bookings";
import { getPublicBusiness } from "@/lib/public-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Consultar agendamento", robots: { index: false, follow: false } };

export default async function ConsultPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) notFound();
  return (
    <BookingShell business={business}>
      <ConsultBookings slug={business.slug} businessName={business.name} tz={business.timezone} whatsapp={business.whatsapp_phone} />
    </BookingShell>
  );
}
