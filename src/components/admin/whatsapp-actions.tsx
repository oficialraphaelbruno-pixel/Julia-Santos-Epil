"use client";
import { BellRing, CalendarCheck, CalendarClock, CalendarX, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildMessage, whatsappLink, type WhatsTemplate } from "@/lib/whatsapp";
import type { Templates } from "@/lib/templates";

const ICONS: Record<WhatsTemplate, React.ComponentType<{ className?: string }>> = {
  personalizada: MessageCircle,
  confirmacao: CalendarCheck,
  lembrete: BellRing,
  cancelamento: CalendarX,
  reagendamento: CalendarClock,
};

const LABELS: Record<WhatsTemplate, string> = {
  personalizada: "Enviar mensagem",
  confirmacao: "Enviar confirmação",
  lembrete: "Enviar lembrete",
  cancelamento: "Avisar cancelamento",
  reagendamento: "Avisar reagendamento",
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
}: {
  phone: string;
  name: string;
  businessName: string;
  service?: string;
  startsAt?: string;
  tz?: string;
  templates: WhatsTemplate[];
  custom?: Templates | null;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const Icon = ICONS[t];
          const href = whatsappLink(phone, buildMessage(t, { nome: name, servico: service, startsAt, tz, empresa: businessName }, custom));
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
