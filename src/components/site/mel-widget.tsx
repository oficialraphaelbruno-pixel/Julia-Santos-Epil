"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarHeart, CalendarSearch, Check, Copy, Gift, HeartHandshake, Loader2, SendHorizontal, X } from "lucide-react";
import { askMelAction, melReferralLinkAction } from "@/app/mel/actions";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { InstagramIcon, WhatsAppIcon } from "@/components/site/icons";
import { cleanVisitorName, type MelAction } from "@/lib/mel-prompt";
import { cn } from "@/lib/utils";

type Kind = "askName" | "menu" | "services" | "referral";
interface Msg {
  role: "user" | "assistant";
  content: string;
  actions?: MelAction[];
  /** Mensagem montada no próprio site (não vai para a OpenAI). */
  local?: boolean;
  kind?: Kind;
}
interface Saved {
  msgs: Msg[];
  visitorName: string | null;
  skippedName: boolean;
  subscribed: boolean;
}
export interface MelReferralInfo {
  rewardLabel: string;
  friendLabel: string | null;
  validDays: number | null;
}

const STORAGE_KEY = "mel-chat-v2";

export function MelWidget({
  slug,
  name,
  welcome,
  services,
  referral,
  bookingHref,
  whatsappHref,
  instagramHref,
  instagramHandle,
}: {
  slug: string;
  name: string;
  welcome: string;
  services: string[];
  referral: MelReferralInfo | null;
  bookingHref: string | null;
  whatsappHref: string | null;
  instagramHref: string | null;
  instagramHandle: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { role: "assistant", content: welcome, local: true },
    { role: "assistant", content: "Antes de começar, como posso te chamar? 😊", local: true, kind: "askName" },
  ]);
  const [visitorName, setVisitorName] = useState<string | null>(null);
  const [skippedName, setSkippedName] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const needsName = !visitorName && !skippedName;
  const consultHref = `/agendar/${slug}/consultar`;

  // Conversa guardada só nesta aba do navegador (some ao fechar a aba).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Saved;
      if (Array.isArray(saved.msgs) && saved.msgs.length) {
        /* eslint-disable react-hooks/set-state-in-effect -- restaura a conversa salva na aba */
        setMsgs(saved.msgs);
        setVisitorName(cleanVisitorName(saved.visitorName));
        setSkippedName(Boolean(saved.skippedName));
        setSubscribed(Boolean(saved.subscribed));
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      /* armazenamento indisponível */
    }
  }, []);
  useEffect(() => {
    try {
      const saved: Saved = { msgs: msgs.slice(-40), visitorName, skippedName, subscribed };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* armazenamento indisponível */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, pending, visitorName, skippedName, subscribed]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const push = (...m: Msg[]) => setMsgs((prev) => [...prev, ...m]);
  const greetName = visitorName ? `, ${visitorName}` : "";

  function handleName(value: string) {
    const typed = value.trim();
    if (!typed) return;
    setText("");
    const n = cleanVisitorName(typed);
    if (!n) {
      push({ role: "user", content: typed, local: true }, { role: "assistant", content: "Não entendi muito bem 🙈 Pode me dizer só o seu primeiro nome?", local: true, kind: "askName" });
      return;
    }
    setVisitorName(n);
    push(
      { role: "user", content: typed, local: true },
      { role: "assistant", content: `Que alegria te conhecer, ${n}! 💛 Me conta: como posso te ajudar? Você pode escolher uma opção ou escrever sua dúvida.`, local: true, kind: "menu" },
    );
  }

  function ask(message: string) {
    const content = message.trim();
    if (!content || pending) return;
    setError(null);
    setText("");
    const history = msgs.filter((m) => !m.local).map((m) => ({ role: m.role, content: m.content }));
    const newsletterOffered = msgs.some((m) => m.actions?.includes("novidades"));
    push({ role: "user", content });
    start(async () => {
      try {
        const r = await askMelAction({ slug, message: content, history, visitorName, newsletterOffered, subscribed });
        if (r.ok) push({ role: "assistant", content: r.reply.answer, actions: r.reply.actions });
        else if (r.reply) push({ role: "assistant", content: r.reply.answer, actions: r.reply.actions });
        else setError(r.error);
      } catch {
        setError("Sem conexão no momento. Tente de novo.");
      }
    });
  }

  function submit() {
    if (needsName) handleName(text);
    else ask(text);
  }

  const menuOptions: { label: string; testId: string; run: () => void }[] = [
    {
      label: "Qual procedimento vou fazer? 🌸",
      testId: "mel-menu-procedimento",
      run: () =>
        push({
          role: "assistant",
          content: `Qual procedimento você vai fazer${greetName}? Assim eu te passo os cuidados certinhos de antes e depois 💛`,
          local: true,
          kind: "services",
        }),
    },
    { label: "Já tenho agendamento", testId: "mel-menu-agendamento", run: () => ask("Já tenho um agendamento e queria mais informações.") },
    { label: "Pagamento e sinal", testId: "mel-menu-pagamento", run: () => ask("Como funciona o pagamento e o sinal?") },
    { label: "Quero agendar", testId: "mel-menu-agendar", run: () => ask("Quero agendar um horário. Como faço?") },
    ...(referral
      ? [
          {
            label: "Programa de indicação 💛",
            testId: "mel-menu-indicacao",
            run: () =>
              push(
                { role: "user", content: "Quero saber do programa de indicação.", local: true },
                { role: "assistant", content: referralText(referral), local: true, kind: "referral" },
              ),
          },
        ]
      : []),
    ...(!subscribed
      ? [
          {
            label: "Quero receber promoções 🎁",
            testId: "mel-menu-promocoes",
            run: () =>
              push({
                role: "assistant",
                content: `Ebaa${greetName}! Deixa seu e-mail aqui que eu te mando as promoções, os descontos e os cupons em primeira mão 💛`,
                actions: ["novidades"],
                local: true,
              }),
          },
        ]
      : []),
  ];

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
            <Image src="/brand/mel-avatar-v2.webp" alt="" width={72} height={72} className="size-14 object-contain sm:size-16" />
            <span className="absolute right-0.5 top-0.5 size-3.5 rounded-full border-2 border-white bg-emerald-500" aria-hidden />
          </span>
        </button>
      ) : null}

      {open ? (
        <div
          className="fixed inset-x-2 bottom-2 z-50 flex max-h-[min(660px,calc(100dvh-1rem))] flex-col overflow-hidden rounded-3xl border border-champagne/50 bg-ivory shadow-[0_24px_60px_-20px_rgba(60,40,10,0.45)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[400px]"
          role="dialog"
          aria-label={`Conversa com a ${name}`}
          data-testid="mel-panel"
        >
          <div className="flex items-center gap-3 bg-[linear-gradient(135deg,#c9a35f_0%,#b68d40_55%,#92702e_100%)] px-4 py-3 text-white">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white/95">
              <Image src="/brand/mel-avatar-v2.webp" alt="" width={48} height={48} className="size-11 object-contain" />
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
            {msgs.map((m, i) => {
              const isLast = i === msgs.length - 1;
              return (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[88%]", m.role === "assistant" && "space-y-2")}>
                    <p
                      className={cn(
                        "whitespace-pre-line rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed",
                        m.role === "user" ? "rounded-br-md bg-gold-dark text-white" : "rounded-bl-md bg-white text-ink shadow-soft",
                      )}
                      data-testid={m.role === "user" ? "mel-msg-user" : "mel-msg-assistant"}
                    >
                      {m.content}
                    </p>

                    {m.kind === "askName" && isLast && needsName ? (
                      <button
                        type="button"
                        className="text-[12.5px] text-muted underline underline-offset-2"
                        onClick={() => {
                          setSkippedName(true);
                          push({ role: "assistant", content: "Tudo bem! 💛 Me conta: como posso te ajudar? Você pode escolher uma opção ou escrever sua dúvida.", local: true, kind: "menu" });
                        }}
                        data-testid="mel-pular-nome"
                      >
                        Prefiro não dizer
                      </button>
                    ) : null}

                    {m.kind === "menu" && isLast && !pending ? (
                      <div className="flex flex-wrap gap-2 pt-1" data-testid="mel-quick">
                        {menuOptions.map((o) => (
                          <Chip key={o.label} onClick={o.run} testId={o.testId}>
                            {o.label}
                          </Chip>
                        ))}
                      </div>
                    ) : null}

                    {m.kind === "services" && isLast && !pending ? (
                      <div className="flex flex-wrap gap-2 pt-1" data-testid="mel-servicos">
                        {services.map((s) => (
                          <Chip key={s} onClick={() => ask(`Vou fazer ${s}. Quais são os cuidados antes e depois?`)}>
                            {s}
                          </Chip>
                        ))}
                        <Chip onClick={() => ask("Ainda não sei qual procedimento fazer. Pode me ajudar?")}>Ainda não sei</Chip>
                      </div>
                    ) : null}

                    {m.kind === "referral" && referral ? (
                      <ReferralBox slug={slug} visitorName={visitorName} whatsappHref={whatsappHref} bookingHref={bookingHref} friendLabel={referral.friendLabel} />
                    ) : null}

                    {m.role === "assistant" && m.actions?.length ? (
                      <div className="flex flex-col gap-2">
                        {m.actions.map((a) =>
                          a === "indicar" ? (
                            referral ? (
                              <ReferralBox key={a} slug={slug} visitorName={visitorName} whatsappHref={whatsappHref} bookingHref={bookingHref} friendLabel={referral.friendLabel} />
                            ) : null
                          ) : (
                            <ActionButton
                              key={a}
                              action={a}
                              slug={slug}
                              bookingHref={bookingHref}
                              consultHref={consultHref}
                              whatsappHref={whatsappHref}
                              instagramHref={instagramHref}
                              instagramHandle={instagramHandle}
                              subscribed={subscribed}
                              onSubscribed={() => setSubscribed(true)}
                            />
                          ),
                        )}
                      </div>
                    ) : null}

                    {m.role === "assistant" && !m.local && isLast && !pending ? (
                      <div className="flex flex-wrap gap-2 pt-1" data-testid="mel-seguir">
                        <Chip
                          onClick={() => push({ role: "assistant", content: `Claro${greetName}! É só escolher uma opção ou escrever sua dúvida 💛`, local: true, kind: "menu" })}
                          testId="mel-outra-duvida"
                        >
                          Tenho outra dúvida
                        </Chip>
                        <Chip onClick={() => ask("Era só isso, obrigada!")} testId="mel-era-so-isso">
                          Era só isso, obrigada 💛
                        </Chip>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {pending ? (
              <div className="flex justify-start" data-testid="mel-typing">
                <span className="inline-flex gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-soft" aria-label={`${name} está digitando`}>
                  <span className="size-2 animate-bounce rounded-full bg-gold [animation-delay:-0.3s]" />
                  <span className="size-2 animate-bounce rounded-full bg-gold [animation-delay:-0.15s]" />
                  <span className="size-2 animate-bounce rounded-full bg-gold" />
                </span>
              </div>
            ) : null}
            {error ? (
              <p className="text-center text-[13px] text-rose-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <form
            className="border-t border-line/70 bg-white px-3 pb-3 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex items-end gap-2">
              <label htmlFor="mel-input" className="sr-only">
                {needsName ? "Seu nome" : "Sua dúvida"}
              </label>
              <textarea
                id="mel-input"
                ref={inputRef}
                rows={1}
                maxLength={needsName ? 60 : 500}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder={needsName ? "Digite seu nome…" : "Escreva sua dúvida…"}
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

function referralText(r: MelReferralInfo) {
  const friend = r.friendLabel ? ` Ela ganha ${r.friendLabel} no primeiro agendamento.` : "";
  const validity = r.validDays ? ` (válido por ${r.validDays} dias)` : "";
  return `Funciona assim 💛\n\n1. Você envia o seu link pessoal para uma amiga que ainda não é cliente.${friend}\n2. A indicação fica registrada quando ela agenda pelo seu link.\n3. Depois que ela for atendida, você ganha ${r.rewardLabel} no seu próximo agendamento${validity}. O desconto entra sozinho quando você agendar pelo site com o mesmo WhatsApp e e-mail do seu cadastro.\n\nPara gerar o seu link, me passa o WhatsApp e o e-mail que você usou no agendamento:`;
}

function Chip({ children, onClick, testId }: { children: React.ReactNode; onClick: () => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-champagne/60 bg-white px-3.5 py-2 text-left text-[13px] font-medium text-gold-dark transition hover:border-gold hover:bg-cream"
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function ReferralBox({
  slug,
  visitorName,
  whatsappHref,
  bookingHref,
  friendLabel,
}: {
  slug: string;
  visitorName: string | null;
  whatsappHref: string | null;
  bookingHref: string | null;
  friendLabel: string | null;
}) {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [result, setResult] = useState<{ link: string; firstName: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  if (result) {
    const share = `Amiga, agenda pelo meu link! ✨${friendLabel ? ` Você ganha ${friendLabel} no primeiro horário.` : ""} ${result.link}`;
    return (
      <div className="space-y-2 rounded-2xl bg-white p-3 shadow-soft" data-testid="mel-indicacao-link">
        <p className="text-[13.5px] text-ink">Prontinho{result.firstName ? `, ${result.firstName}` : ""}! 💛 Este é o seu link pessoal. Copie e envie para a sua amiga:</p>
        <p className="break-all rounded-xl bg-ivory p-2.5 font-mono text-[12.5px] text-gold-deep" data-testid="mel-indicacao-url">
          {result.link}
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gold-dark px-4 py-2 text-[13px] font-medium text-white"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* o link continua visível para copiar à mão */
              }
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Link copiado!" : "Copiar meu link"}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(share)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1f9d55] px-4 py-2 text-[13px] font-medium text-white"
          >
            <WhatsAppIcon className="size-4" /> Enviar pelo WhatsApp
          </a>
        </div>
        <p className="text-[12px] text-muted">
          Quando ela agendar por esse link, a indicação fica registrada. Depois que ela for atendida, o seu desconto entra sozinho no seu próximo agendamento.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-2 rounded-2xl bg-white p-3 shadow-soft"
      data-testid="mel-indicacao-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await melReferralLinkAction({ slug, phone, email });
          if (r.ok) setResult({ link: r.link, firstName: r.firstName || visitorName || "" });
          else {
            setError(r.error);
            setNotFound(Boolean(r.notFound));
          }
        });
      }}
    >
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <HeartHandshake className="size-4 text-gold" /> Gerar meu link de indicação
      </p>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        placeholder="WhatsApp com DDD"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="h-11 w-full rounded-full border border-line bg-ivory px-4 text-[14px] outline-none focus:border-champagne focus:ring-4 focus:ring-champagne/15"
        aria-label="WhatsApp com DDD"
      />
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="E-mail do cadastro"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 w-full rounded-full border border-line bg-ivory px-4 text-[14px] outline-none focus:border-champagne focus:ring-4 focus:ring-champagne/15"
        aria-label="E-mail do cadastro"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gold-dark text-[14px] font-medium text-white disabled:opacity-60"
        data-testid="mel-indicacao-gerar"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Gerar meu link
      </button>
      {error ? (
        <div className="space-y-2 text-[12.5px] text-rose-600" role="alert">
          <p>{error}</p>
          {notFound ? (
            <p className="text-muted">
              O programa é para quem já tem cadastro.{" "}
              {bookingHref ? (
                <Link href={bookingHref} className="text-gold-dark underline">
                  Agende seu primeiro horário
                </Link>
              ) : null}
              {whatsappHref ? (
                <>
                  {bookingHref ? " ou " : ""}
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-gold-dark underline">
                    fale com a gente no WhatsApp
                  </a>
                </>
              ) : null}
              .
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function ActionButton({
  action,
  slug,
  bookingHref,
  consultHref,
  whatsappHref,
  instagramHref,
  instagramHandle,
  subscribed,
  onSubscribed,
}: {
  action: MelAction;
  slug: string;
  bookingHref: string | null;
  consultHref: string;
  whatsappHref: string | null;
  instagramHref: string | null;
  instagramHandle: string | null;
  subscribed: boolean;
  onSubscribed: () => void;
}) {
  const base = "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition";
  if (action === "agendar" && bookingHref) {
    return (
      <Link href={bookingHref} className={cn(base, "bg-gold-dark text-white hover:brightness-110")} data-testid="mel-action-agendar">
        <CalendarHeart className="size-4" /> Agendar meu horário
      </Link>
    );
  }
  if (action === "consultar") {
    return (
      <Link href={consultHref} className={cn(base, "border border-champagne/70 bg-white text-gold-dark hover:bg-cream")} data-testid="mel-action-consultar">
        <CalendarSearch className="size-4" /> Consultar meu agendamento
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
  if (action === "novidades") return <NovidadesBox slug={slug} subscribed={subscribed} onSubscribed={onSubscribed} />;
  return null;
}

/** Caixa de e-mail dentro do chat. Some só se a pessoa já estava inscrita quando a caixa apareceu. */
function NovidadesBox({ slug, subscribed, onSubscribed }: { slug: string; subscribed: boolean; onSubscribed: () => void }) {
  const [alreadySubscribed] = useState(subscribed);
  if (alreadySubscribed) return null;
  return (
    <div className="rounded-2xl bg-white p-3 shadow-soft" data-testid="mel-action-novidades">
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink">
        <Gift className="size-4 text-gold" /> Promoções, descontos e cupons no seu e-mail
      </p>
      <NewsletterForm slug={slug} source="assistente" compact onDone={onSubscribed} />
    </div>
  );
}
