"use client";
import { Landmark, QrCode, Timer } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/site/icons";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PIX_KEY_TYPE_LABEL } from "@/lib/pix";
import { whatsappLink } from "@/lib/whatsapp";
import type { DepositInfo } from "@/lib/pix-server";

/** Instruções para pagamento do sinal via Pix (QR code + copia e cola). */
export function DepositCard({
  deposit,
  tz,
  reference,
  whatsapp,
}: {
  deposit: DepositInfo;
  tz: string;
  reference: string;
  whatsapp: string | null;
}) {
  return (
    <div className="rounded-3xl border-2 border-champagne/70 bg-white p-6 text-left shadow-soft" data-testid="deposit-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">Sinal para garantir o horário</p>
          <p className="mt-1 font-display text-3xl text-ink" data-testid="deposit-amount">
            {formatMoney(deposit.amountCents)}
          </p>
          <p className="text-[13px] text-muted">Pagamento via Pix</p>
        </div>
        <span className="grid size-11 place-items-center rounded-full bg-cream text-gold">
          <QrCode className="size-5" />
        </span>
      </div>

      {deposit.dueAt ? (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <Timer className="size-4 shrink-0" /> Envie o sinal até {formatDateTime(deposit.dueAt, tz)} para manter a reserva.
        </p>
      ) : null}

      {deposit.qrSvg ? (
        <div className="mt-5 flex flex-col items-center gap-3">
          <div
            className="size-52 rounded-2xl border border-line bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
            aria-label="QR code do Pix"
            role="img"
            dangerouslySetInnerHTML={{ __html: deposit.qrSvg }}
          />
          <p className="text-[12px] text-muted">Abra o app do seu banco e escaneie, ou use o Pix copia e cola:</p>
        </div>
      ) : null}

      {deposit.payload ? (
        <div className="mt-3">
          <p className="break-all rounded-xl bg-ivory p-3 font-mono text-[11px] leading-relaxed text-ink/70" data-testid="pix-payload">
            {deposit.payload}
          </p>
          <CopyButton value={deposit.payload} label="Copiar Pix copia e cola" className="mt-2 w-full" />
        </div>
      ) : null}

      <dl className="mt-5 space-y-2 border-t border-line/70 pt-4 text-sm">
        {deposit.keyDisplay ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Chave Pix ({PIX_KEY_TYPE_LABEL[deposit.keyType ?? ""] ?? "chave"})</dt>
            <dd className="font-medium">{deposit.keyDisplay}</dd>
          </div>
        ) : null}
        {deposit.holder ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Favorecida</dt>
            <dd className="text-right font-medium">{deposit.holder}</dd>
          </div>
        ) : null}
        {deposit.bank ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Banco</dt>
            <dd className="flex items-center gap-1.5 text-right font-medium">
              <Landmark className="size-3.5 text-gold" /> {deposit.bank}
            </dd>
          </div>
        ) : null}
      </dl>
      {deposit.instructions ? <p className="mt-4 whitespace-pre-line text-[13px] text-ink/75">{deposit.instructions}</p> : null}
      <p className="mt-4 text-[12.5px] text-muted">
        Confira o nome da favorecida antes de confirmar o Pix. Seu horário será confirmado assim que o studio identificar o pagamento.
      </p>
      {whatsapp ? (
        <Button asChild variant="whatsapp" className="mt-4 w-full">
          <a
            href={whatsappLink(whatsapp, `Olá! Segue o comprovante do sinal do meu agendamento ${reference} (${formatMoney(deposit.amountCents)}). ✨`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon /> Enviar comprovante pelo WhatsApp
          </a>
        </Button>
      ) : null}
    </div>
  );
}
