import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/site/brand-logo";
import type { PublicBusiness } from "@/lib/public-data";

export function LegalPage({ business, title, text, isDefault }: { business: PublicBusiness; title: string; text: string; isDefault: boolean }) {
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
        <h1 className="mt-4 text-4xl text-ink">{title}</h1>
        <article className="card-premium mt-8 whitespace-pre-line p-6 text-[15px] leading-relaxed text-ink/80 sm:p-10">{text}</article>
        {isDefault ? <p className="mt-4 text-xs text-muted">Versão padrão do sistema.</p> : null}
      </main>
    </div>
  );
}
