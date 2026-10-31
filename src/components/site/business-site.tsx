import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, CalendarHeart, Clock3, MapPin, MousePointerClick, Sparkles, UserRound } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ServiceCard } from "@/components/site/service-card";
import { InstagramIcon, WhatsAppIcon } from "@/components/site/icons";
import { Button } from "@/components/ui/button";
import { businessAddress, type PublicBusiness, type PublicService } from "@/lib/public-data";
import type { Category } from "@/lib/types";
import { formatPhone } from "@/lib/phone";
import { whatsappLink } from "@/lib/whatsapp";

const STEPS = [
  { icon: Sparkles, title: "Escolha o serviço", text: "Veja os serviços disponíveis, a duração e o valor de cada um." },
  { icon: CalendarHeart, title: "Escolha data e horário", text: "O calendário mostra somente horários realmente livres." },
  { icon: UserRound, title: "Informe seus dados", text: "Nome e WhatsApp. Não é preciso criar conta nem senha." },
  { icon: CalendarCheck, title: "Pronto!", text: "Você recebe um número de referência e um link para gerenciar seu horário." },
];

export function BusinessSite({
  business,
  services,
  categories,
  onlineEnabled,
}: {
  business: PublicBusiness;
  services: PublicService[];
  categories: Category[];
  onlineEnabled: boolean;
}) {
  const bookingHref = `/agendar/${business.slug}`;
  const address = businessAddress(business);
  const wa = business.whatsapp_phone
    ? whatsappLink(business.whatsapp_phone, `Olá! Vim pelo site da ${business.name} e gostaria de mais informações. ✨`)
    : null;
  const firstName = business.name.split(" ")[0];

  const grouped = categories
    .map((c) => ({ category: c, items: services.filter((s) => s.category_id === c.id) }))
    .filter((g) => g.items.length);
  const uncategorized = services.filter((s) => !s.category_id || !categories.some((c) => c.id === s.category_id));

  return (
    <>
      <SiteHeader logo={business.logo_url} name={business.name} bookingHref={bookingHref} />

      <main id="inicio">
        {/* ===================== HERO ===================== */}
        <section className="grain relative overflow-hidden pt-24 sm:pt-28">
          <div className="pointer-events-none absolute -right-32 top-24 hidden size-[28rem] rounded-full border border-champagne/25 md:block" aria-hidden />
          <div className="pointer-events-none absolute -right-20 top-36 hidden size-[28rem] rounded-full border border-champagne/15 md:block" aria-hidden />

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 sm:px-8 md:grid-cols-[1.05fr_0.95fr] md:gap-14 md:pb-24">
            <div className="animate-fade-up text-center md:text-left">
              <p className="ornament">{business.name}</p>
              <h1 className="mt-6 text-[2.6rem] leading-[1.08] text-ink sm:text-6xl">
                {(business.hero_title ?? "Seu momento de cuidado começa aqui.").split(" ").slice(0, -2).join(" ")}{" "}
                <em className="gold-text font-medium italic">
                  {(business.hero_title ?? "Seu momento de cuidado começa aqui.").split(" ").slice(-2).join(" ")}
                </em>
              </h1>
              <p className="mx-auto mt-6 max-w-md text-[17px] leading-relaxed text-muted md:mx-0">
                {business.hero_subtitle ??
                  "Agende seu atendimento com praticidade e reserve um momento especial de cuidado para você."}
              </p>
              <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row md:justify-start sm:justify-center">
                {onlineEnabled ? (
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href={bookingHref}>
                      <CalendarHeart /> Agendar meu horário
                    </Link>
                  </Button>
                ) : null}
                {wa ? (
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                    <a href={wa} target="_blank" rel="noopener noreferrer">
                      <WhatsAppIcon /> Falar pelo WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            {business.photo_url ? (
              <div className="animate-fade-up relative mx-auto w-full max-w-[22rem] [animation-delay:150ms] md:max-w-[26rem]">
                <div className="absolute -inset-3 translate-x-3 translate-y-3 rounded-t-full rounded-b-[2rem] border border-champagne/60" aria-hidden />
                <div className="relative aspect-[697/907] overflow-hidden rounded-t-full rounded-b-[2rem] bg-cream shadow-lift">
                  <Image
                    src={business.photo_url}
                    alt={`Foto de ${business.name}`}
                    fill
                    priority
                    sizes="(min-width: 768px) 420px, 90vw"
                    className="object-cover"
                  />
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-white/95 px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.2em] text-gold-dark shadow-soft backdrop-blur">
                  {business.name}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* ===================== SOBRE ===================== */}
        <section id="sobre" className="scroll-mt-20 bg-white py-20 sm:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 md:grid-cols-2">
            {business.photo_url ? (
              <div className="relative order-2 mx-auto w-full max-w-sm md:order-1">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-soft">
                  <Image src={business.photo_url} alt={`${business.name}`} fill sizes="(min-width: 768px) 380px, 90vw" className="object-cover object-top" />
                </div>
                <div className="absolute -right-4 -top-4 hidden size-24 rounded-full border border-champagne/50 sm:block" aria-hidden />
              </div>
            ) : null}
            <div className="order-1 text-center md:order-2 md:text-left">
              <p className="ornament">Sobre</p>
              <h2 className="mt-5 text-4xl leading-tight text-ink sm:text-5xl">
                {business.about_title ?? (
                  <>
                    Conheça a <span className="gold-text italic">{firstName}</span>
                  </>
                )}
              </h2>
              {business.about_text ? (
                <div className="mt-6 space-y-4 whitespace-pre-line text-[16px] leading-relaxed text-ink/75">{business.about_text}</div>
              ) : (
                <p className="mt-6 text-[16px] leading-relaxed text-ink/75">
                  Acompanhe o trabalho, as novidades e os bastidores do studio no Instagram.
                </p>
              )}
              {business.philosophy_text ? (
                <blockquote className="mt-8 border-l-2 border-champagne pl-5 text-left font-display text-xl italic leading-relaxed text-gold-deep">
                  {business.philosophy_text}
                </blockquote>
              ) : null}
              {business.instagram_url ? (
                <Button asChild variant="outline" className="mt-8">
                  <a href={business.instagram_url} target="_blank" rel="noopener noreferrer">
                    <InstagramIcon /> Seguir no Instagram
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        {/* ===================== SERVIÇOS ===================== */}
        <section id="servicos" className="grain scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="text-center">
              <p className="ornament">Nossos serviços</p>
              <h2 className="mt-5 text-4xl text-ink sm:text-5xl">Cuidado em cada detalhe</h2>
            </div>

            {services.length === 0 ? (
              <div className="mx-auto mt-12 max-w-lg rounded-3xl border border-line bg-white/80 p-8 text-center shadow-soft">
                <p className="font-display text-xl text-ink">Serviços em breve</p>
                <p className="mt-2 text-sm text-muted">Para informações sobre serviços e valores, fale conosco pelo WhatsApp.</p>
                {wa ? (
                  <Button asChild variant="whatsapp" className="mt-6">
                    <a href={wa} target="_blank" rel="noopener noreferrer">
                      <WhatsAppIcon /> Falar pelo WhatsApp
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="mt-14 space-y-14">
                {grouped.map((g) => (
                  <div key={g.category.id}>
                    <h3 className="mb-6 text-center font-display text-2xl text-gold-dark md:text-left">{g.category.name}</h3>
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {g.items.map((s) => (
                        <ServiceCard key={s.id} service={s} bookingHref={bookingHref} />
                      ))}
                    </div>
                  </div>
                ))}
                {uncategorized.length ? (
                  <div>
                    {grouped.length ? <h3 className="mb-6 text-center font-display text-2xl text-gold-dark md:text-left">Outros serviços</h3> : null}
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {uncategorized.map((s) => (
                        <ServiceCard key={s.id} service={s} bookingHref={bookingHref} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        {/* ===================== COMO FUNCIONA ===================== */}
        <section id="como-funciona" className="scroll-mt-20 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="text-center">
              <p className="ornament">Agendamento online</p>
              <h2 className="mt-5 text-4xl text-ink sm:text-5xl">Como funciona</h2>
              <p className="mx-auto mt-4 max-w-md text-muted">Em poucos toques, direto do seu celular.</p>
            </div>
            <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-3xl border border-line bg-ivory/60 p-6">
                  <span className="absolute right-5 top-4 font-display text-4xl text-champagne/40">{i + 1}</span>
                  <div className="grid size-12 place-items-center rounded-full bg-white text-gold shadow-soft">
                    <s.icon className="size-5" />
                  </div>
                  <h3 className="mt-5 font-display text-lg text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
            {onlineEnabled ? (
              <div className="mt-12 text-center">
                <Button asChild size="lg">
                  <Link href={bookingHref}>
                    <MousePointerClick /> Agendar meu horário
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        {/* ===================== CONTATO ===================== */}
        <section id="contato" className="grain scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
            <p className="ornament">Localização e contato</p>
            <h2 className="mt-5 text-4xl text-ink sm:text-5xl">Vamos conversar?</h2>
            <div className="mt-12 grid gap-5 text-left sm:grid-cols-2">
              {business.whatsapp_phone ? (
                <a
                  href={wa!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-3xl border border-line bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#1f9d55]/10 text-[#1f9d55]">
                    <WhatsAppIcon className="size-6" />
                  </span>
                  <span>
                    <span className="block text-xs uppercase tracking-[0.2em] text-muted">WhatsApp</span>
                    <span className="mt-1 block font-display text-lg text-ink">{formatPhone(business.whatsapp_phone)}</span>
                  </span>
                </a>
              ) : null}
              {business.instagram_url ? (
                <a
                  href={business.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-3xl border border-line bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-cream text-gold-dark">
                    <InstagramIcon className="size-6" />
                  </span>
                  <span>
                    <span className="block text-xs uppercase tracking-[0.2em] text-muted">Instagram</span>
                    <span className="mt-1 block font-display text-lg text-ink">
                      @{business.instagram_url.replace(/\/$/, "").split("/").pop()}
                    </span>
                  </span>
                </a>
              ) : null}
              {address ? (
                <div className="flex items-start gap-4 rounded-3xl border border-line bg-white p-6 shadow-soft sm:col-span-2">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-cream text-gold-dark">
                    <MapPin className="size-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-xs uppercase tracking-[0.2em] text-muted">Endereço</span>
                    <span className="mt-1 block text-[15px] leading-relaxed text-ink">{address}</span>
                    {business.maps_url ? (
                      <a href={business.maps_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-medium text-gold-dark underline-offset-4 hover:underline">
                        Ver no mapa
                      </a>
                    ) : null}
                  </span>
                </div>
              ) : null}
              {business.business_hours_note ? (
                <div className="flex items-start gap-4 rounded-3xl border border-line bg-white p-6 shadow-soft sm:col-span-2">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-cream text-gold-dark">
                    <Clock3 className="size-5" />
                  </span>
                  <span>
                    <span className="block text-xs uppercase tracking-[0.2em] text-muted">Horários</span>
                    <span className="mt-1 block whitespace-pre-line text-[15px] leading-relaxed text-ink">{business.business_hours_note}</span>
                  </span>
                </div>
              ) : null}
            </div>
            {wa ? (
              <Button asChild variant="whatsapp" size="lg" className="mt-10">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon /> Falar pelo WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </section>

        {/* ===================== CTA FINAL ===================== */}
        {onlineEnabled ? (
          <section id="agendar" className="relative overflow-hidden bg-ink py-20 text-center text-white">
            <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_50%_0%,#c9a35f,transparent_60%)]" aria-hidden />
            <div className="relative mx-auto max-w-2xl px-5">
              <p className="ornament !text-champagne">Reserve seu momento</p>
              <h2 className="mt-5 text-4xl leading-tight sm:text-5xl">Seu horário está a poucos toques</h2>
              <Button asChild size="lg" className="mt-9">
                <Link href={bookingHref}>
                  <CalendarHeart /> Agendar meu horário
                </Link>
              </Button>
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter business={business} />
    </>
  );
}
