import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarOff, Search } from "lucide-react";
import { BookingShell, BookingWizard } from "@/components/booking/booking-wizard";
import { WhatsAppIcon } from "@/components/site/icons";
import { Button } from "@/components/ui/button";
import { getLinkCoupon, getPublicBookingData, getPublicBusiness } from "@/lib/public-data";
import { cleanCouponCode } from "@/lib/coupon-code";
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
  searchParams: Promise<{ servico?: string; cupom?: string }>;
}) {
  const { slug } = await params;
  const { servico, cupom } = await searchParams;
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
  // Link de divulgação com cupom (ex.: /agendar/slug?cupom=VIRILHA30)
  const couponCode = cleanCouponCode(cupom);
  const linkCoupon = couponCode ? await getLinkCoupon(business.id, business.timezone, couponCode) : null;
  const couponServices = linkCoupon?.serviceIds ? services.filter((s) => linkCoupon.serviceIds!.includes(s.id)) : null;
  // Cupom de um serviço só: o link já abre com esse serviço escolhido.
  const initialServiceId = servico ?? (couponServices?.length === 1 ? couponServices[0].id : undefined);
  return (
    <BookingShell business={business}>
      {settings.intro_text ? (
        <p className="mx-auto mb-8 max-w-2xl text-center text-[15px] leading-relaxed text-ink/70 whitespace-pre-line">{settings.intro_text}</p>
      ) : null}
      <div className="mx-auto mb-6 flex max-w-2xl justify-end">
        <Link
          href={`/agendar/${business.slug}/consultar`}
          className="inline-flex items-center gap-2 rounded-full border border-champagne/60 bg-white px-4 py-2 text-[13px] font-medium text-gold-dark shadow-soft transition hover:border-gold"
          data-testid="link-consultar"
        >
          <Search className="size-4" /> Já agendei: consultar meu agendamento
        </Link>
      </div>
      <BookingWizard
        business={business}
        services={services}
        categories={categories}
        settings={settings}
        professionalName={professionalName}
        todayKey={today}
        maxKey={addDaysKey(today, settings.max_advance_days)}
        initialServiceId={initialServiceId}
        linkCoupon={linkCoupon ? { code: linkCoupon.code, label: linkCoupon.label, serviceNames: couponServices?.map((s) => s.name) ?? null } : null}
        linkCouponUnavailable={Boolean(couponCode && !linkCoupon)}
        siteUrl={SITE_URL}
      />
    </BookingShell>
  );
}
