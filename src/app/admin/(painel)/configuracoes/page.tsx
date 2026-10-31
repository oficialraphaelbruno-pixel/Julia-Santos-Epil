import type { Metadata } from "next";
import Link from "next/link";
import { CalendarSync, Download, Mail, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { ProfileForm } from "@/components/admin/profile-form";
import { BusinessImageField } from "@/components/admin/business-image-field";
import { LegalForm } from "@/components/admin/legal-form";
import { PasswordForm } from "@/components/admin/password-form";
import { MfaManager } from "@/components/admin/mfa-manager";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { defaultPrivacyPolicy, defaultTerms } from "@/lib/legal-defaults";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Configurações" };

const SECTIONS = [
  ["dados", "Dados do studio"],
  ["imagens", "Logomarca e fotografias"],
  ["integracoes", "Integrações"],
  ["equipe", "Equipe"],
  ["privacidade", "Privacidade e termos"],
  ["seguranca", "Segurança"],
  ["exportacao", "Exportação de dados"],
];

export default async function SettingsPage() {
  const ctx = await requireAdmin();
  const isOwner = ctx.role === "owner";
  const { data: members } = await ctx.supabase.from("business_members").select("user_id, role, created_at").eq("business_id", ctx.business.id);

  return (
    <>
      <PageHeader title="Configurações" description="Tudo é salvo no banco de dados e reflete no site." />
      <nav className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Seções">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] text-ink/70 hover:border-champagne">
            {label}
          </a>
        ))}
      </nav>

      <section id="dados" className="scroll-mt-20">
        <ProfileForm business={ctx.business} canEdit={isOwner} />
      </section>

      <section id="imagens" className="mt-8 scroll-mt-20">
        <h2 className="mb-3 font-display text-xl">Logomarca e fotografias</h2>
        <div className="card-premium grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
          <BusinessImageField field="logo_url" value={ctx.business.logo_url} label="Logomarca" aspect="aspect-[3/2]" fit="contain" canEdit={isOwner} />
          <BusinessImageField
            field="photo_url"
            value={ctx.business.photo_url}
            label="Fotografia principal"
            description="Destaque na página inicial e na seção Sobre."
            aspect="aspect-[3/4]"
            canEdit={isOwner}
          />
        </div>
        <p className="mt-2 text-[12px] text-muted">As imagens são exibidas sem distorção, preservando a proporção original.</p>
      </section>

      <section id="integracoes" className="mt-8 scroll-mt-20">
        <h2 className="mb-3 font-display text-xl">Integrações</h2>
        <div className="card-premium flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="flex items-center gap-3 text-sm text-ink/80">
            <CalendarSync className="size-5 text-gold" /> Google Agenda, e-mail e WhatsApp automático
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/integracoes">Integrações</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/comunicacao">
                <Mail /> Comunicação
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="equipe" className="mt-8 scroll-mt-20">
        <h2 className="mb-3 font-display text-xl">Equipe</h2>
        <div className="card-premium p-5 sm:p-6">
          <ul className="divide-y divide-line/70">
            {(members ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center gap-3 py-3 text-sm">
                <Users className="size-4 text-gold" />
                <span className="flex-1">{m.user_id === ctx.userId ? `${ctx.email} (você)` : "Membro da equipe"}</span>
                <span className="text-muted">{m.role === "owner" ? "Proprietária" : "Funcionária"} · desde {formatDate(m.created_at, ctx.business.timezone)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-muted">
            Novos acessos são criados pelo procedimento seguro descrito no Guia de Administração (não há cadastro público). Convites pelo painel chegam na Fase 3.
          </p>
        </div>
      </section>

      <section id="privacidade" className="mt-8 scroll-mt-20">
        <h2 className="mb-3 font-display text-xl">Privacidade e termos</h2>
        <LegalForm
          privacy={ctx.business.privacy_policy ?? ""}
          terms={ctx.business.terms_of_use ?? ""}
          defaultPrivacy={defaultPrivacyPolicy(ctx.business.name)}
          defaultTerms={defaultTerms(ctx.business.name)}
          canEdit={isOwner}
        />
      </section>

      <section id="seguranca" className="mt-8 scroll-mt-20">
        <h2 className="mb-3 font-display text-xl">Segurança</h2>
        <div className="card-premium space-y-4 p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-emerald-600" /> Conectada como <b className="font-medium">{ctx.email}</b>
          </p>
          <PasswordForm />
          <MfaManager />
        </div>
      </section>

      <section id="exportacao" className="mt-8 scroll-mt-20">
        <h2 className="mb-3 font-display text-xl">Exportação de dados</h2>
        <div className="card-premium flex flex-wrap gap-2 p-5 sm:p-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/exportar/clientes.csv" prefetch={false}>
              <Download /> Clientes (CSV)
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/exportar/agendamentos.csv" prefetch={false}>
              <Download /> Agendamentos (CSV)
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
