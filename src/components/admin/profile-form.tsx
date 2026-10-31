"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { saveBusinessProfileAction, type ProfileInput } from "@/app/admin/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { formatPhone } from "@/lib/phone";
import type { Business } from "@/lib/types";

export function ProfileForm({ business, canEdit }: { business: Business; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<ProfileInput>({
    defaultValues: {
      name: business.name,
      whatsapp: business.whatsapp_phone ? formatPhone(business.whatsapp_phone) : "",
      instagram: business.instagram_url ?? "",
      email: business.email ?? "",
      addressLine: business.address_line ?? "",
      addressDistrict: business.address_district ?? "",
      addressCity: business.address_city ?? "",
      addressState: business.address_state ?? "",
      addressZip: business.address_zip ?? "",
      mapsUrl: business.maps_url ?? "",
      legalName: business.legal_name ?? "",
      documentId: business.document_id ?? "",
      hoursNote: business.business_hours_note ?? "",
      heroTitle: business.hero_title ?? "",
      heroSubtitle: business.hero_subtitle ?? "",
      aboutTitle: business.about_title ?? "",
      aboutText: business.about_text ?? "",
      philosophyText: business.philosophy_text ?? "",
    },
  });
  const e = form.formState.errors;
  const r = form.register;

  return (
    <form
      className="space-y-6"
      onSubmit={form.handleSubmit((v) =>
        start(async () => {
          const res = await saveBusinessProfileAction(v);
          if (res.ok) {
            toast.success(res.message ?? "Salvo!");
            router.refresh();
          } else {
            toast.error(res.error);
            Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof ProfileInput, { message: m }));
          }
        }),
      )}
    >
      <fieldset disabled={!canEdit} className="space-y-6">
        <section className="card-premium grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <h3 className="font-display text-lg sm:col-span-2">Dados do studio</h3>
          <Field label="Nome comercial *" htmlFor="pf-name" error={e.name?.message}>
            <Input id="pf-name" {...r("name")} />
          </Field>
          <Field label="WhatsApp comercial" htmlFor="pf-wa" error={e.whatsapp?.message}>
            <Input id="pf-wa" type="tel" {...r("whatsapp")} />
          </Field>
          <Field label="Instagram (link)" htmlFor="pf-ig" error={e.instagram?.message}>
            <Input id="pf-ig" placeholder="https://www.instagram.com/..." {...r("instagram")} />
          </Field>
          <Field label="E-mail comercial" htmlFor="pf-email" error={e.email?.message}>
            <Input id="pf-email" type="email" {...r("email")} />
          </Field>
          <Field label="Razão social (rodapé, opcional)" htmlFor="pf-legal">
            <Input id="pf-legal" {...r("legalName")} />
          </Field>
          <Field label="CNPJ/CPF (rodapé, opcional)" htmlFor="pf-doc">
            <Input id="pf-doc" {...r("documentId")} />
          </Field>
        </section>

        <section className="card-premium grid gap-4 p-5 sm:grid-cols-6 sm:p-6">
          <div className="sm:col-span-6">
            <h3 className="font-display text-lg">Endereço</h3>
            <p className="text-[13px] text-muted">Só aparece no site depois de preenchido.</p>
          </div>
          <Field label="Rua, número e complemento" htmlFor="pf-addr" className="sm:col-span-4">
            <Input id="pf-addr" {...r("addressLine")} />
          </Field>
          <Field label="Bairro" htmlFor="pf-dist" className="sm:col-span-2">
            <Input id="pf-dist" {...r("addressDistrict")} />
          </Field>
          <Field label="Cidade" htmlFor="pf-city" className="sm:col-span-3">
            <Input id="pf-city" {...r("addressCity")} />
          </Field>
          <Field label="UF" htmlFor="pf-uf" className="sm:col-span-1">
            <Input id="pf-uf" maxLength={2} {...r("addressState")} />
          </Field>
          <Field label="CEP" htmlFor="pf-zip" className="sm:col-span-2">
            <Input id="pf-zip" {...r("addressZip")} />
          </Field>
          <Field label="Link do Google Maps (opcional)" htmlFor="pf-maps" error={e.mapsUrl?.message} className="sm:col-span-6">
            <Input id="pf-maps" placeholder="https://maps.app.goo.gl/..." {...r("mapsUrl")} />
          </Field>
          <Field label="Texto de horários exibido no site (opcional)" htmlFor="pf-hours" className="sm:col-span-6" hint="Ex.: Segunda a sexta, 9h às 19h. Os horários reais de agendamento ficam em Horários.">
            <Textarea id="pf-hours" rows={2} {...r("hoursNote")} />
          </Field>
        </section>

        <section className="card-premium grid gap-4 p-5 sm:p-6">
          <h3 className="font-display text-lg">Conteúdo do site</h3>
          <Field label="Título principal" htmlFor="pf-ht">
            <Input id="pf-ht" {...r("heroTitle")} />
          </Field>
          <Field label="Subtítulo" htmlFor="pf-hs">
            <Textarea id="pf-hs" rows={2} {...r("heroSubtitle")} />
          </Field>
          <Field label="Título da seção Sobre" htmlFor="pf-at" hint="Deixe em branco para usar “Conheça a …”.">
            <Input id="pf-at" {...r("aboutTitle")} />
          </Field>
          <Field label="Sobre (trajetória)" htmlFor="pf-about" hint="Conte sua história com suas palavras. Nada é preenchido automaticamente.">
            <Textarea id="pf-about" rows={6} {...r("aboutText")} />
          </Field>
          <Field label="Filosofia de atendimento (frase de destaque)" htmlFor="pf-phil">
            <Textarea id="pf-phil" rows={2} {...r("philosophyText")} />
          </Field>
        </section>
      </fieldset>
      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Salvar dados
          </Button>
        </div>
      ) : null}
    </form>
  );
}
