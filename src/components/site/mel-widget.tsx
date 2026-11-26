"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarHeart, Gift, SendHorizontal, X } from "lucide-react";
import { askMelAction } from "@/app/mel/actions";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { InstagramIcon, WhatsAppIcon } from "@/components/site/icons";
import type { MelAction } from "@/lib/mel-prompt";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  actions?: MelAction[];
  welcome?: boolean;
}

const QUICK = [
  { label: "Como me preparar? 🌸", text: "Como devo me preparar antes da epilação?" },
  { label: "Cuidados depois ✨", text: "Quais cuidados devo ter depois da epilação?" },
  { label: "Pagamento e sinal", text: "Como funciona o pagamento e o sinal?" },
  { label: "Quero agendar", text: "Quero agendar um horário. Como faço?" },
  { label: "Cancelar ou remarcar", text: "Como faço para cancelar ou remarcar?" },
];

const STORAGE_KEY = "mel-chat-v1";

export function MelWidget({
  slug,
  name,
  welcome,
  bookingHref,
  whatsappHref,
  instagramHref,
  instagramHandle,
}: {
  slug: string;
  name: string;
  welcome: string;
  bookingHref: string | null;
  whatsappHref: string | null;
  instagramHref: string | null;
  instagramHandle: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: welcome, welcome: true }]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Conversa guardada só nesta aba do navegador (some ao fechar).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Msg[];
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura a conversa salva na aba
        if (Array.isArray(parsed) && parsed.length) setMsgs(parsed);
      }
    } catch {
      /* armazenamento indisponível */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-30)));
    } catch {
      /* armazenamento indisponível */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, pending]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  function send(value: string) {
    const message = value.trim();
    if (!message || pending) return;
    setError(null);
    setText("");
    const history = msgs.filter((m) => !m.welcome).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: message }]);
    start(async () => {
      try {
        const r = await askMelAction({ slug, message, history });
        if (r.ok) setMsgs((m) => [...m, { role: "assistant", content: r.reply.answer, actions: r.reply.actions }]);
        else if (r.reply) setMsgs((m) => [...m, { role: "assistant", content: r.reply!.answer, actions: r.reply!.actions }]);
        else setError(r.error);
      } catch {
        setError("Sem conexão no momento. Tente de novo.");
      }
    });
  }

  const started = msgs.some((m) => m.role === "user");

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group fixed bottom-4 right-4 z-50 flex items-center gap-2 sm:bottom-6 sm:right-6"
          aria-label={`Abrir conversa com a ${name}, assistente virtual`}
          data-testid="mel-open"
        >
          <span className="hidden rounded-full bg-white px-4 py-2 text-[13px] font-medium text-ink shadow-lift ring-1 ring-champagne/40 transition group-hover:-translate-x-0.5 sm:block">
            Dúvidas? Fale com a {name} 💛
          </span>
          <span className="relative grid size-16 place-items-center rounded-full bg-white shadow-lift ring-2 ring-champagne/70 transition group-hover:scale-105 sm:size-[72px]">
            <Image src="/brand/mel-avatar.webp" alt="" width={72} height={72} className="size-14 object-contain sm:size-16" priority={false} />
            <span className="absolute right-0.5 top-0.5 size-3.5 rounded-full border-2 border-white bg-emerald-500" aria-hidden />
          </span>
        </button>
      ) : null}

      {open ? (
        <div
          className="fixed inset-x-2 bottom-2 z-50 flex max-h-[min(640px,calc(100dvh-1rem))] flex-col overflow-hidden rounded-3xl border border-champagne/50 bg-ivory shadow-[0_24px_60px_-20px_rgba(60,40,10,0.45)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[390px]"
          role="dialog"
          aria-label={`Conversa com a ${name}`}
          data-testid="mel-panel"
        >
          <div className="flex items-center gap-3 bg-[linear-gradient(135deg,#c9a35f_0%,#b68d40_55%,#92702e_100%)] px-4 py-3 text-white">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/95">
              <Image src="/brand/mel-avatar.webp" alt="" width={48} height={48} className="size-11 object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-tight">{name}</p>
              <p className="text-[12px] text-white/85">Assistente virtual · responde na hora</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full hover:bg-white/15" aria-label="Fechar conversa" data-testid="mel-close">
              <X className="size-5" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[86%]", m.role === "user" ? "" : "space-y-2")}>
                  <p
                    className={cn(
                      "whitespace-pre-line rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed",
                      m.role === "user" ? "rounded-br-md bg-gold-dark text-white" : "rounded-bl-md bg-white text-ink shadow-soft",
                    )}
                    data-testid={m.role === "user" ? "mel-msg-user" : "mel-msg-assistant"}
                  >
                    {m.content}
                  </p>
                  {m.role === "assistant" && m.actions?.length ? (
                    <div className="flex flex-col gap-2">
                      {m.actions.map((a) => (
                        <ActionButton
                          key={a}
                          action={a}
                          slug={slug}
                          bookingHref={bookingHref}
                          whatsappHref={whatsappHref}
                          instagramHref={instagramHref}
                          instagramHandle={instagramHandle}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex justify-start" data-testid="mel-typing">
                <span className="inline-flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-soft" aria-label={`${name} está digitando`}>
                  <span className="size-2 animate-bounce rounded-full bg-gold [animation-delay:-0.3s]" />
                  <span className="size-2 animate-bounce rounded-full bg-gold [animation-delay:-0.15s]" />
                  <span className="size-2 animate-bounce rounded-full bg-gold" />
                </span>
              </div>
            ) : null}
            {!started && !pending ? (
              <div className="flex flex-wrap gap-2 pt-1" data-testid="mel-quick">
                {QUICK.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => send(q.text)}
                    className="rounded-full border border-champagne/60 bg-white px-3.5 py-2 text-[13px] font-medium text-gold-dark transition hover:border-gold hover:bg-cream"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            ) : null}
            {error ? <p className="text-center text-[13px] text-rose-600" role="alert">{error}</p> : null}
          </div>

          <form
            className="border-t border-line/70 bg-white px-3 pb-3 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <div className="flex items-end gap-2">
              <label htmlFor="mel-input" className="sr-only">
                Sua dúvida
              </label>
              <textarea
                id="mel-input"
                ref={inputRef}
                rows={1}
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(text);
                  }
                }}
                placeholder="Escreva sua dúvida…"
                className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-ivory px-4 py-2.5 text-[15px] text-ink outline-none placeholder:text-muted/70 focus:border-champagne focus:ring-4 focus:ring-champagne/15"
                data-testid="mel-input"
              />
              <button
                type="submit"
                disabled={pending || !text.trim()}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-gold-dark text-white transition hover:brightness-110 disabled:opacity-40"
                aria-label="Enviar"
                data-testid="mel-send"
              >
                <SendHorizontal className="size-5" />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-[11px] leading-snug text-muted">
              Sou uma assistente virtual e posso errar. Não envie dados de saúde ou documentos.{" "}
              <Link href="/privacidade" className="underline underline-offset-2">
                Privacidade
              </Link>
            </p>
          </form>
        </div>
      ) : null}
    </>
  );
}

function ActionButton({
  action,
  slug,
  bookingHref,
  whatsappHref,
  instagramHref,
  instagramHandle,
}: {
  action: MelAction;
  slug: string;
  bookingHref: string | null;
  whatsappHref: string | null;
  instagramHref: string | null;
  instagramHandle: string | null;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition";
  if (action === "agendar" && bookingHref) {
    return (
      <Link href={bookingHref} className={cn(base, "bg-gold-dark text-white hover:brightness-110")} data-testid="mel-action-agendar">
        <CalendarHeart className="size-4" /> Agendar meu horário
      </Link>
    );
  }
  if (action === "whatsapp" && whatsappHref) {
    return (
      <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={cn(base, "bg-[#1f9d55] text-white hover:bg-[#178246]")} data-testid="mel-action-whatsapp">
        <WhatsAppIcon className="size-4" /> Falar no WhatsApp
      </a>
    );
  }
  if (action === "instagram" && instagramHref) {
    return (
      <a href={instagramHref} target="_blank" rel="noopener noreferrer" className={cn(base, "border border-champagne/70 bg-white text-gold-dark hover:bg-cream")} data-testid="mel-action-instagram">
        <InstagramIcon className="size-4" /> Seguir {instagramHandle ?? "no Instagram"}
      </a>
    );
  }
  if (action === "novidades") {
    return (
      <div className="rounded-2xl bg-white p-3 shadow-soft" data-testid="mel-action-novidades">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <Gift className="size-4 text-gold" /> Receba as promoções por e-mail
        </p>
        <NewsletterForm slug={slug} source="assistente" compact />
      </div>
    );
  }
  return null;
}
