import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Link2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { BookingSettingsForm } from "@/components/admin/booking-settings-form";
import { BusinessImageField } from "@/components/admin/business-image-field";
import { InstagramIcon, WhatsAppIcon } from "@/components/site/icons";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { requireAdmin } from "@/lib/auth";
import { SITE_URL } from "@/lib/env";
import { whatsappShareLink } from "@/lib/whatsapp";
import type { BookingSettings } from "@/lib/types";

export const metadata: Metadata = { title: "Agendamento Online" };

export default async function OnlineBookingPage() {
  const ctx = await requireAdmin();
  const { data: settings } = await ctx.supabase.from("booking_settings").select("*").eq("business_id", ctx.business.id).single();
  const url = `${SITE_URL}/agendar/${ctx.business.slug}`;
  const s = settings as BookingSettings;

  return (
    <>
      <PageHeader title="Agendamento Online" description="Sua página pública de reservas. Alterações refletem imediatamente no site." />

      <div className="card-premium mb-6 overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#faf7f2,#fff)] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Link2 className="size-4 text-gold" /> Seu link de agendamento
            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.online_enabled ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
              {s.online_enabled ? "ATIVO" : "DESATIVADO"}
            </span>
          </div>
          <p className="mt-3 break-all rounded-xl border border-line bg-white px-4 py-3 font-mono text-[14px] text-gold-deep" data-testid="booking-url">
            {url}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton value={url} size="sm" />
            <Button asChild size="sm" variant="whatsapp">
              <a href={whatsappShareLink(`Agende seu horário na ${ctx.business.name} ✨\n${url}`)} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> Compartilhar no WhatsApp
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/agendar/${ctx.business.slug}`} target="_blank">
                <ExternalLink /> Ver página pública
              </Link>
            </Button>
          </div>
          <p className="mt-4 flex items-start gap-2 text-[13px] text-muted">
            <InstagramIcon className="mt-0.5 size-4 shrink-0 text-gold" />
            Para o Instagram: copie o link e cole em “Editar perfil” → “Links” → “Adicionar link externo”.
          </p>
        </div>
      </div>

      <h2 className="mb-3 font-display text-xl">Regras de agendamento</h2>
      <BookingSettingsForm settings={s} canEdit={ctx.role === "owner"} />

      <h2 className="mb-3 mt-8 font-display text-xl">Aparência</h2>
      <div className="card-premium grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
        <BusinessImageField field="logo_url" value={ctx.business.logo_url} label="Logomarca" aspect="aspect-[3/2]" fit="contain" canEdit={ctx.role === "owner"} />
        <BusinessImageField
          field="cover_url"
          value={ctx.business.cover_url}
          label="Foto de capa da página de agendamento"
          description="Opcional. Exibida no topo da página de reservas."
          aspect="aspect-[16/9]"
          canEdit={ctx.role === "owner"}
        />
      </div>
      <p className="mt-3 text-[13px] text-muted">
        Disponibilidade (dias, horários e bloqueios) é configurada em{" "}
        <Link href="/admin/horarios" className="text-gold-dark underline">
          Horários
        </Link>
        .
      </p>
    </>
  );
}
