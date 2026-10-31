"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveServiceAction, type ServiceInput } from "@/app/admin/actions/services";
import { ImageUpload } from "@/components/admin/image-upload";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { centsToInput } from "@/lib/format";
import type { Category, Professional, Service } from "@/lib/types";

export function ServiceForm({
  service,
  comboItems,
  categories,
  professionals,
  allServices,
  onDone,
}: {
  service?: Service | null;
  comboItems?: string[];
  categories: Category[];
  professionals: Professional[];
  allServices: Service[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [creatingCategory, setCreatingCategory] = useState(false);
  const form = useForm<ServiceInput>({
    defaultValues: {
      id: service?.id ?? null,
      name: service?.name ?? "",
      categoryId: service?.category_id ?? "",
      newCategory: "",
      description: service?.description ?? "",
      price: service ? centsToInput(service.price_cents) : "",
      duration: service?.duration_minutes ?? 30,
      prep: service?.prep_minutes ?? 0,
      buffer: service?.buffer_after_minutes ?? 0,
      professionalId: service?.professional_id ?? "",
      status: service?.status ?? "active",
      showOnline: service?.show_online ?? true,
      isCombo: service?.is_combo ?? false,
      comboItems: comboItems ?? [],
      imageUrl: service?.image_url ?? null,
    },
  });
  const errors = form.formState.errors;
  const isCombo = form.watch("isCombo");

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit((values) =>
        start(async () => {
          const res = await saveServiceAction(values);
          if (res.ok) {
            toast.success(res.message ?? "Salvo!");
            router.refresh();
            onDone();
          } else {
            toast.error(res.error);
            Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof ServiceInput, { message: m }));
          }
        }),
      )}
    >
      <Field label="Nome do serviço *" htmlFor="sv-name" error={errors.name?.message}>
        <Input id="sv-name" {...form.register("name", { required: "Informe o nome do serviço" })} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Categoria" htmlFor="sv-cat">
          {creatingCategory ? (
            <div className="flex gap-2">
              <Input id="sv-cat" placeholder="Nova categoria" {...form.register("newCategory")} />
              <Button type="button" variant="ghost" size="sm" className="h-11" onClick={() => { setCreatingCategory(false); form.setValue("newCategory", ""); }}>
                ✕
              </Button>
            </div>
          ) : (
            <Select
              id="sv-cat"
              {...form.register("categoryId")}
              onChange={(e) => {
                if (e.target.value === "__new") {
                  setCreatingCategory(true);
                  form.setValue("categoryId", "");
                } else form.setValue("categoryId", e.target.value);
              }}
            >
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="__new">+ Nova categoria…</option>
            </Select>
          )}
        </Field>
        <Field label="Valor (R$) *" htmlFor="sv-price" error={errors.price?.message}>
          <Input id="sv-price" inputMode="decimal" placeholder="0,00" {...form.register("price", { required: "Informe o valor" })} />
        </Field>
      </div>

      <Field label="Descrição" htmlFor="sv-desc" hint="Opcional. Aparece no site e no agendamento.">
        <Textarea id="sv-desc" rows={3} {...form.register("description")} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Duração (min) *" htmlFor="sv-dur" error={errors.duration?.message}>
          <Input id="sv-dur" type="number" min={5} max={720} step={5} {...form.register("duration")} />
        </Field>
        <Field label="Preparação" htmlFor="sv-prep" hint="min antes">
          <Input id="sv-prep" type="number" min={0} max={240} step={5} {...form.register("prep")} />
        </Field>
        <Field label="Intervalo após" htmlFor="sv-buf" hint="min depois">
          <Input id="sv-buf" type="number" min={0} max={240} step={5} {...form.register("buffer")} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Profissional responsável" htmlFor="sv-prof">
          <Select id="sv-prof" {...form.register("professionalId")}>
            <option value="">Padrão do studio</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Situação" htmlFor="sv-status">
          <Select id="sv-status" {...form.register("status")}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="archived">Arquivado</option>
          </Select>
        </Field>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-ink/80">Imagem (opcional)</p>
        <Controller
          control={form.control}
          name="imageUrl"
          render={({ field }) => <ImageUpload value={field.value ?? null} onChange={field.onChange} kind="servico" />}
        />
      </div>

      <div className="space-y-3 rounded-2xl bg-ivory p-4">
        <Controller
          control={form.control}
          name="showOnline"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                <span className="font-medium text-ink">Disponível no agendamento online</span>
                <span className="block text-[12.5px] text-muted">Aparece no site e no link de agendamento.</span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
        <Controller
          control={form.control}
          name="isCombo"
          render={({ field }) => (
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                <span className="font-medium text-ink">É um combo</span>
                <span className="block text-[12.5px] text-muted">Agrupa outros serviços com valor e duração próprios.</span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
        {isCombo ? (
          <Controller
            control={form.control}
            name="comboItems"
            render={({ field }) => (
              <div className="grid gap-2 border-t border-line pt-3">
                {allServices.filter((s) => s.id !== service?.id && !s.is_combo && s.status !== "archived").length === 0 ? (
                  <p className="text-[13px] text-muted">Cadastre outros serviços para compor o combo.</p>
                ) : null}
                {allServices
                  .filter((s) => s.id !== service?.id && !s.is_combo && s.status !== "archived")
                  .map((s) => {
                    const checked = (field.value ?? []).includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-[#b68d40]"
                          checked={checked}
                          onChange={(e) =>
                            field.onChange(e.target.checked ? [...(field.value ?? []), s.id] : (field.value ?? []).filter((x) => x !== s.id))
                          }
                        />
                        {s.name}
                      </label>
                    );
                  })}
              </div>
            )}
          />
        ) : null}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null} Salvar serviço
        </Button>
      </div>
    </form>
  );
}
