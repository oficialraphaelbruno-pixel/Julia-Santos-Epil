"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { subscribeNewsletterAction } from "@/app/novidades/actions";
import { cn } from "@/lib/utils";

/** "Fique por dentro das promoções": e-mail + aceite registrado no banco. */
export function NewsletterForm({
  slug,
  source,
  compact = false,
  className,
  onDone,
}: {
  slug: string;
  source: "site" | "faq" | "assistente";
  compact?: boolean;
  className?: string;
  onDone?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send(value: string, confirmed = false) {
    setError(null);
    start(async () => {
      const r = await subscribeNewsletterAction({ slug, email: value, source, website }, confirmed);
      if (r.ok) {
        setDone(r.message);
        setSuggestion(null);
        onDone?.();
      } else {
        setError(r.error);
        setSuggestion(r.suggestion ?? null);
      }
    });
  }

  if (done) {
    return (
      <p className={cn("flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800", className)} data-testid="newsletter-ok" role="status">
        <Check className="mt-0.5 size-4 shrink-0" /> {done}
      </p>
    );
  }

  return (
    <form
      className={cn("w-full", className)}
      data-testid={`newsletter-${source}`}
      onSubmit={(e) => {
        e.preventDefault();
        send(email);
      }}
    >
      <div className={cn("flex gap-2", compact ? "flex-col" : "flex-col sm:flex-row")}>
        <label className="sr-only" htmlFor={`nl-${source}`}>
          Seu e-mail
        </label>
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gold" aria-hidden />
          <input
            id={`nl-${source}`}
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="seuemail@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-full border border-line bg-white pl-11 pr-4 text-[15px] text-ink outline-none transition placeholder:text-muted/70 focus:border-champagne focus:ring-4 focus:ring-champagne/15"
          />
        </div>
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
          aria-hidden
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#c9a35f_0%,#b68d40_50%,#92702e_100%)] px-6 text-[15px] font-medium text-white shadow-[0_8px_20px_-8px_rgba(146,112,46,0.65)] transition hover:brightness-[1.06] disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Quero receber
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-[13px] text-rose-600" role="alert">
          {error}{" "}
          {suggestion ? (
            <>
              <button type="button" className="font-medium underline" onClick={() => { setEmail(suggestion); send(suggestion, true); }}>
                Sim, corrigir
              </button>{" "}
              ·{" "}
              <button type="button" className="underline" onClick={() => send(email, true)}>
                Não, está certo
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      <p className="mt-2 text-[12px] leading-relaxed text-muted">
        Ao enviar, você aceita receber novidades e promoções por e-mail. Dá para sair quando quiser.{" "}
        <Link href="/privacidade" className="underline underline-offset-2">
          Política de Privacidade
        </Link>
      </p>
    </form>
  );
}
