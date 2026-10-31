"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { SecretLogo } from "@/components/site/secret-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#sobre", label: "Sobre" },
  { href: "#servicos", label: "Serviços" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#contato", label: "Contato" },
];

export function SiteHeader({ logo, name, bookingHref }: { logo: string | null; name: string; bookingHref: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-500",
        scrolled || open ? "bg-ivory/90 shadow-[0_1px_0_rgba(201,163,95,0.25)] backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:h-20 sm:px-8">
        <SecretLogo src={logo} name={name} className="h-12 w-[78px] sm:h-14 sm:w-[90px]" />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Principal">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink/70 transition hover:text-gold-dark">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href={bookingHref}>Agendar horário</Link>
          </Button>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-gold-dark md:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="animate-fade-in border-t border-line/60 bg-ivory px-5 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col" aria-label="Menu">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/50 py-4 font-display text-lg text-ink"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <Button asChild className="mt-5 w-full" size="lg">
            <Link href={bookingHref}>Agendar meu horário</Link>
          </Button>
        </div>
      ) : null}
    </header>
  );
}
