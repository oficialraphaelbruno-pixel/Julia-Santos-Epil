"use client";
import { Landmark, QrCode, Timer } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/site/icons";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PIX_KEY_TYPE_LABEL } from "@/lib/pix";
import { whatsappLink } from "@/lib/whatsapp";
import type { DepositInfo } from "@/lib/pix-server";

/** Instruções para pagamento do sinal via Pix (passo a passo + copia e cola + QR code + chave). */
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
  const amount = formatMoney(deposit.amountCents);
  const keyLabel = PIX_KEY_TYPE_LABEL[deposit.keyType ?? ""] ?? "chave";
  return (
    <div className="rounded-3xl border-2 border-champagne/70 bg-white p-6 text-left shadow-soft" data-testid="deposit-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-dark">Sinal para confirmar o horário</p>
          <p className="mt-1 font-display text-3xl text-ink" data-testid="deposit-amount">
            {amount}
          </p>
          <p className="text-[13px] text-muted">Pagamento via Pix · o valor é descontado do total no dia do atendimento</p>
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

      <div className="mt-5 rounded-2xl bg-ivory p-4" data-testid="deposit-steps">
        <p className="mb-2 text-sm font-semibold text-ink">Como pagar o sinal</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink/80">
          <li>Abra o aplicativo do seu banco e entre na área <b>Pix</b>.</li>
          <li>
            Escolha uma das opções:
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                <b>Pix Copia e Cola</b> (mais fácil no celular): toque em &ldquo;Copiar código Pix&rdquo; abaixo e cole no app do banco. O valor
                já vem preenchido.
              </li>
              <li>
                <b>Ler QR Code</b>: se estiver no computador, aponte a câmera do celular para o QR Code abaixo.
              </li>
              {deposit.keyDisplay ? (
                <li>
                  <b>Pagar com chave</b>: use a chave {keyLabel.toLowerCase()} <b>{deposit.keyDisplay}</b> e digite o valor de {amount}.
                </li>
              ) : null}
            </ul>
          </li>
          <li>
            Antes de confirmar, confira o valor ({amount})
            {deposit.holder ? (
              <>
                {" "}
                e o nome da favorecida: <b>{deposit.holder}</b>
              </>
            ) : null}
            .
          </li>
          <li>Envie o comprovante pelo WhatsApp (botão no final), informando a referência {reference}.</li>
          <li>Pronto! Assim que o studio identificar o pagamento, seu horário é confirmado e você recebe a confirmação por e-mail.</li>
        </ol>
      </div>

      {deposit.payload ? (
        <div className="mt-5">
          <p className="mb-1.5 text-[13px] font-medium text-ink/80">Pix Copia e Cola</p>
          <p className="break-all rounded-xl bg-ivory p-3 font-mono text-[11px] leading-relaxed text-ink/70" data-testid="pix-payload">
            {deposit.payload}
          </p>
          <CopyButton value={deposit.payload} label="Copiar código Pix" className="mt-2 w-full" />
        </div>
      ) : null}

      {deposit.qrSvg ? (
        <div className="mt-5 flex flex-col items-center gap-2">
          <p className="text-[13px] font-medium text-ink/80">QR Code do Pix</p>
          <div
            className="size-52 rounded-2xl border border-line bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
            aria-label="QR code do Pix"
            role="img"
            dangerouslySetInnerHTML={{ __html: deposit.qrSvg }}
          />
        </div>
      ) : null}

      <dl className="mt-5 space-y-2 border-t border-line/70 pt-4 text-sm">
        {deposit.keyDisplay ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Chave Pix ({keyLabel})</dt>
            <dd className="flex items-center gap-2 font-medium">
              {deposit.keyDisplay}
              {deposit.keyValue ? <CopyButton value={deposit.keyValue} label="Copiar" size="sm" variant="soft" /> : null}
            </dd>
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
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Valor</dt>
          <dd className="font-medium">{amount}</dd>
        </div>
      </dl>
      {deposit.instructions ? <p className="mt-4 whitespace-pre-line text-[13px] text-ink/75">{deposit.instructions}</p> : null}
      {whatsapp ? (
        <Button asChild variant="whatsapp" className="mt-5 w-full">
          <a
            href={whatsappLink(whatsapp, `Olá! Segue o comprovante do sinal do meu agendamento ${reference} (${amount}). ✨`)}
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
