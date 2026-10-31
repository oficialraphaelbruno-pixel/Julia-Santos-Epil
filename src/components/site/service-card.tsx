import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration, formatMoney } from "@/lib/format";
import type { PublicService } from "@/lib/public-data";

export function ServiceCard({ service, bookingHref }: { service: PublicService; bookingHref: string }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-soft transition duration-500 hover:-translate-y-1 hover:shadow-lift">
      {service.image_url ? (
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={service.image_url}
            alt={service.name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-700 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div className="h-1.5 bg-[linear-gradient(90deg,#c9a35f,#ebe1d1,#b68d40)]" aria-hidden />
      )}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl leading-snug text-ink">{service.name}</h3>
          {service.is_combo ? (
            <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-dark">Combo</span>
          ) : null}
        </div>
        {service.description ? <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{service.description}</p> : null}
        <div className="mt-auto pt-6">
          <div className="flex items-end justify-between border-t border-line/70 pt-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <Clock className="size-4 text-gold" /> {formatDuration(service.duration_minutes)}
            </span>
            <span className="font-display text-2xl text-gold-dark">{formatMoney(service.price_cents)}</span>
          </div>
          <Button asChild variant="outline" className="mt-5 w-full">
            <Link href={`${bookingHref}?servico=${service.id}`}>Agendar este serviço</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
