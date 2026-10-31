import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarOff } from "lucide-react";
import { BookingShell, BookingWizard } from "@/components/booking/booking-wizard";
import { WhatsAppIcon } from "@/components/site/icons";
import { Button } from "@/components/ui/button";
import { getPublicBookingData, getPublicBusiness } from "@/lib/public-data";
import { addDaysKey, todayKey } from "@/lib/format";
import { SITE_URL } from "@/lib/env";
import { whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) return { title: "Agendamento" };
  return {
    title: { absolute: `Agendar horário | ${business.name}` },
    description: `Agende seu atendimento na ${business.name} de forma rápida, direto pelo celular.`,
  };
}

export default async function AgendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servico?: string }>;
}) {
  const { slug } = await params;
  const { servico } = await searchParams;
  const business = await getPublicBusiness(slug);
  if (!business) notFound();
  const { settings, services, categories, professionalName } = await getPublicBookingData(business.id);

  if (!settings?.online_enabled) {
    return (
      <BookingShell business={business}>
        <div className="mx-auto max-w-md rounded-3xl border border-line bg-white p-8 text-center shadow-soft">
          <CalendarOff className="mx-auto size-10 text-gold" />
          <h1 className="mt-5 text-2xl text-ink">Agendamento online indisponível</h1>
          <p className="mt-2 text-sm text-muted">No momento, os agendamentos estão sendo feitos diretamente com o studio.</p>
          {business.whatsapp_phone ? (
            <Button asChild variant="whatsapp" className="mt-6">
              <a href={whatsappLink(business.whatsapp_phone, "Olá! Gostaria de agendar um horário. ✨")} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> Agendar pelo WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </BookingShell>
    );
  }

  const today = todayKey(business.timezone);
  return (
    <BookingShell business={business}>
      {settings.intro_text ? (
        <p className="mx-auto mb-8 max-w-2xl text-center text-[15px] leading-relaxed text-ink/70 whitespace-pre-line">{settings.intro_text}</p>
      ) : null}
      <BookingWizard
        business={business}
        services={services}
        categories={categories}
        settings={settings}
        professionalName={professionalName}
        todayKey={today}
        maxKey={addDaysKey(today, settings.max_advance_days)}
        initialServiceId={servico}
        siteUrl={SITE_URL}
      />
    </BookingShell>
  );
}
