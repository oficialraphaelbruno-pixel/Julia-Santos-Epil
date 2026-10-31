import Link from "next/link";
import { BrandLogo } from "@/components/site/brand-logo";
import { InstagramIcon, WhatsAppIcon } from "@/components/site/icons";
import { formatPhone } from "@/lib/phone";
import { whatsappLink } from "@/lib/whatsapp";
import type { PublicBusiness } from "@/lib/public-data";

export function SiteFooter({ business }: { business: PublicBusiness }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line/80 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <BrandLogo src={business.logo_url} name={business.name} className="h-16 w-[100px]" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{business.name}</p>
        </div>
        <div>
          <p className="ornament !justify-start before:hidden">Contato</p>
          <ul className="mt-4 space-y-3 text-sm">
            {business.instagram_url ? (
              <li>
                <a href={business.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-ink/80 hover:text-gold-dark">
                  <InstagramIcon className="size-4 text-gold" /> Instagram
                </a>
              </li>
            ) : null}
            {business.whatsapp_phone ? (
              <li>
                <a href={whatsappLink(business.whatsapp_phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-ink/80 hover:text-gold-dark">
                  <WhatsAppIcon className="size-4 text-gold" /> {formatPhone(business.whatsapp_phone)}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
        <div>
          <p className="ornament !justify-start before:hidden">Informações</p>
          <ul className="mt-4 space-y-3 text-sm text-ink/80">
            <li>
              <Link href="/privacidade" className="hover:text-gold-dark">Política de Privacidade</Link>
            </li>
            <li>
              <Link href="/termos" className="hover:text-gold-dark">Termos de Uso</Link>
            </li>
            {business.legal_name ? <li className="text-muted">{business.legal_name}</li> : null}
            {business.document_id ? <li className="text-muted">{business.document_id}</li> : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-line/60 py-6 text-center text-xs text-muted">
        © {year} {business.name}. Todos os direitos reservados.
      </div>
    </footer>
  );
}
