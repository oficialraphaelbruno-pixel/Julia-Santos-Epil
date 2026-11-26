import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarHeart, ChevronDown, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/site/brand-logo";
import { SiteFooter } from "@/components/site/site-footer";
import { InstagramIcon, WhatsAppIcon } from "@/components/site/icons";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { MelWidget } from "@/components/site/mel-widget";
import { Button } from "@/components/ui/button";
import { DEFAULT_BUSINESS_SLUG } from "@/lib/env";
import { getPublicBusiness } from "@/lib/public-data";
import { getFaqData, getPublicAssistant } from "@/lib/faq-data";
import { autoAnswers, careByService, FAQ_CATEGORIES, instagramHandle, type FaqCategory } from "@/lib/faq-content";
import { whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dúvidas frequentes",
  description: "Cuidados antes e depois da epilação, pagamento, sinal e agendamento.",
};

function Item({ q, a, testId }: { q: string; a: string; testId?: string }) {
  return (
    <details className="group rounded-2xl border border-line bg-white shadow-soft open:shadow-lift" data-testid={testId}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium text-ink [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <ChevronDown className="size-4 shrink-0 text-gold transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="whitespace-pre-line px-5 pb-5 text-[15px] leading-relaxed text-ink/80">{a}</div>
    </details>
  );
}

export default async function FaqPage() {
  const business = await getPublicBusiness(DEFAULT_BUSINESS_SLUG);
  if (!business) notFound();
  const [{ faq, services, settings }, assistant] = await Promise.all([getFaqData(business.id), getPublicAssistant(business.id)]);
  const auto = autoAnswers(business, settings);
  const pre = careByService(services, "pre");
  const pos = careByService(services, "pos");
  const ig = instagramHandle(business.instagram_url);
  const wa = business.whatsapp_phone ? whatsappLink(business.whatsapp_phone, `Olá! Vim pela página de dúvidas do site da ${business.name}. ✨`) : null;
  const bookingHref = `/agendar/${business.slug}`;

  const sections = FAQ_CATEGORIES.map((c) => ({
    ...c,
    custom: faq.filter((f) => f.category === c.key),
    auto: auto.filter((a) => a.category === c.key),
    care: c.key === "pre" ? pre : c.key === "pos" ? pos : [],
  })).filter((s) => s.custom.length || s.auto.length || s.care.length);

  return (
    <div className="grain min-h-dvh">
      <header className="border-b border-line/60">
        <div className="mx-auto flex h-18 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gold-dark">
            <ArrowLeft className="size-4" /> Voltar
          </Link>
          <BrandLogo src={business.logo_url} name={business.name} className="h-11 w-[70px]" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="ornament">{business.name}</p>
        <h1 className="mt-4 text-4xl text-ink sm:text-5xl">Dúvidas frequentes</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          Cuidados antes e depois da epilação, pagamento, sinal e agendamento: reunimos aqui as respostas para as dúvidas mais comuns.
        </p>

        {sections.length > 1 ? (
          <nav className="mt-8 flex flex-wrap gap-2" aria-label="Assuntos">
            {sections.map((s) => (
              <a key={s.key} href={`#${s.key}`} className="rounded-full border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink/80 transition hover:border-champagne hover:text-gold-dark">
                {s.short}
              </a>
            ))}
          </nav>
        ) : null}

        {sections.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-line bg-white p-6 text-muted">Em breve as respostas estarão aqui. Enquanto isso, fale com a gente pelo WhatsApp. 💛</p>
        ) : null}

        <div className="mt-10 space-y-12">
          {sections.map((s) => (
            <section key={s.key} id={s.key} className="scroll-mt-6" data-testid={`faq-${s.key as FaqCategory}`}>
              <h2 className="font-display text-2xl text-ink sm:text-3xl">{s.label}</h2>
              <div className="mt-5 space-y-3">
                {s.custom.map((f) => (
                  <Item key={f.id} q={f.question} a={f.answer} testId="faq-item" />
                ))}
                {s.auto.map((a) => (
                  <Item key={a.id} q={a.question} a={a.answer} testId={a.id} />
                ))}
              </div>
              {s.care.length ? (
                <div className="mt-6">
                  <p className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.16em] text-gold-dark">
                    <Sparkles className="size-4" /> {s.key === "pre" ? "Como se preparar, por serviço" : "Cuidados depois, por serviço"}
                  </p>
                  <div className="space-y-3" data-testid={`care-${s.key}`}>
                    {s.care.map((c) => (
                      <Item key={c.name} q={c.name} a={c.text} />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ))}
        </div>

        <section className="mt-16 rounded-3xl border border-champagne/50 bg-white p-6 text-center shadow-soft sm:p-10">
          <h2 className="font-display text-2xl text-ink sm:text-3xl">Ainda ficou com alguma dúvida?</h2>
          <p className="mt-2 text-[15px] text-muted">Fale com a gente. Vai ser um prazer te atender. 💛</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {settings?.online_enabled ? (
              <Button asChild size="lg">
                <Link href={bookingHref}>
                  <CalendarHeart /> Agendar meu horário
                </Link>
              </Button>
            ) : null}
            {wa ? (
              <Button asChild size="lg" variant="whatsapp">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon /> Falar no WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
          {business.instagram_url && ig ? (
            <a
              href={business.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gold-dark underline-offset-4 hover:underline"
              data-testid="faq-instagram"
            >
              <InstagramIcon className="size-4" /> Siga {ig} no Instagram
            </a>
          ) : null}
        </section>

        <section className="mt-8 rounded-3xl bg-ink p-6 text-white sm:p-10" id="novidades">
          <p className="ornament !justify-start !text-champagne before:hidden">Fique por dentro</p>
          <h2 className="mt-3 font-display text-2xl sm:text-3xl">Receba as promoções em primeira mão</h2>
          <p className="mt-2 text-[15px] text-white/75">Novidades, datas especiais e cupons direto no seu e-mail.</p>
          <div className="mt-5 rounded-2xl bg-white p-4 sm:p-5">
            <NewsletterForm slug={business.slug} source="faq" />
          </div>
        </section>
      </main>

      <SiteFooter business={business} />
      {assistant ? (
        <MelWidget
          slug={business.slug}
          name={assistant.name}
          welcome={assistant.welcome}
          bookingHref={settings?.online_enabled ? bookingHref : null}
          whatsappHref={wa}
          instagramHref={business.instagram_url}
          instagramHandle={ig}
        />
      ) : null}
    </div>
  );
}
