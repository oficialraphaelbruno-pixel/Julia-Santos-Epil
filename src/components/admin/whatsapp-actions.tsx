"use client";
import { BellRing, CalendarCheck, CalendarClock, CalendarX, ClipboardList, HeartHandshake, MessageCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildMessage, whatsappLink, type WhatsTemplate } from "@/lib/whatsapp";
import type { Templates } from "@/lib/templates";

const ICONS: Record<WhatsTemplate, React.ComponentType<{ className?: string }>> = {
  personalizada: MessageCircle,
  confirmacao: CalendarCheck,
  lembrete: BellRing,
  cancelamento: CalendarX,
  reagendamento: CalendarClock,
  sinal: QrCode,
  orientacoes_pre: ClipboardList,
  orientacoes_pos: HeartHandshake,
};

const LABELS: Record<WhatsTemplate, string> = {
  personalizada: "Enviar mensagem",
  confirmacao: "Enviar confirmação",
  lembrete: "Enviar lembrete",
  cancelamento: "Avisar cancelamento",
  reagendamento: "Avisar reagendamento",
  sinal: "Cobrar sinal (Pix)",
  orientacoes_pre: "Orientações pré",
  orientacoes_pos: "Orientações pós",
};

/**
 * Abre o WhatsApp (link oficial wa.me) com a mensagem preenchida.
 * O envio é feito manualmente pela profissional — o sistema NÃO marca como enviada.
 */
export function WhatsAppActions({
  phone,
  name,
  businessName,
  service,
  startsAt,
  tz,
  templates,
  custom,
  extra,
}: {
  phone: string;
  name: string;
  businessName: string;
  service?: string;
  startsAt?: string;
  tz?: string;
  templates: WhatsTemplate[];
  custom?: Templates | null;
  extra?: { sinal?: string; pix?: string; preCare?: string | null; postCare?: string | null };
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const Icon = ICONS[t];
          const orientacoes = t === "orientacoes_pre" ? extra?.preCare : t === "orientacoes_pos" ? extra?.postCare : undefined;
          const href = whatsappLink(
            phone,
            buildMessage(t, { nome: name, servico: service, startsAt, tz, empresa: businessName, sinal: extra?.sinal, pix: extra?.pix, orientacoes: orientacoes ?? undefined }, custom),
          );
          return (
            <Button key={t} asChild size="sm" variant={t === "personalizada" ? "whatsapp" : "outline"}>
              <a href={href} target="_blank" rel="noopener noreferrer" data-testid={`wa-${t}`}>
                <Icon /> {LABELS[t]}
              </a>
            </Button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-muted">Abre o WhatsApp com a mensagem pronta. O envio é feito por você.</p>
    </div>
  );
}
