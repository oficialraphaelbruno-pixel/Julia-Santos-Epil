"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { saveLegalTextsAction } from "@/app/admin/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";

export function LegalForm({ privacy, terms, defaultPrivacy, defaultTerms, canEdit }: { privacy: string; terms: string; defaultPrivacy: string; defaultTerms: string; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({ privacy, terms });
  const [pending, start] = useTransition();
  return (
    <div className="card-premium space-y-4 p-5 sm:p-6">
      <p className="text-[13px] text-muted">
        Em branco, o site exibe um modelo padrão. Recomendamos revisar os textos com apoio jurídico.
      </p>
      <Field label="Política de Privacidade" htmlFor="lg-priv">
        <Textarea id="lg-priv" rows={8} disabled={!canEdit} value={v.privacy} placeholder={defaultPrivacy} onChange={(e) => setV({ ...v, privacy: e.target.value })} />
      </Field>
      {canEdit && !v.privacy ? (
        <button type="button" className="-mt-2 text-[13px] text-gold-dark underline" onClick={() => setV({ ...v, privacy: defaultPrivacy })}>
          Começar a partir do modelo
        </button>
      ) : null}
      <Field label="Termos de Uso" htmlFor="lg-terms">
        <Textarea id="lg-terms" rows={8} disabled={!canEdit} value={v.terms} placeholder={defaultTerms} onChange={(e) => setV({ ...v, terms: e.target.value })} />
      </Field>
      {canEdit && !v.terms ? (
        <button type="button" className="-mt-2 text-[13px] text-gold-dark underline" onClick={() => setV({ ...v, terms: defaultTerms })}>
          Começar a partir do modelo
        </button>
      ) : null}
      {canEdit ? (
        <div className="flex justify-end">
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveLegalTextsAction(v);
                if (r.ok) {
                  toast.success(r.message ?? "Salvo!");
                  router.refresh();
                } else toast.error(r.error);
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Salvar textos
          </Button>
        </div>
      ) : null}
    </div>
  );
}
