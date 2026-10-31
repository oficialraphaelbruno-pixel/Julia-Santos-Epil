"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Clock, Eye, EyeOff, Pencil, Plus, Power, Sparkles, Tags, Trash2 } from "lucide-react";
import { ServiceForm } from "@/components/admin/service-form";
import { deleteCategoryAction, renameCategoryAction, setServiceStatusAction } from "@/app/admin/actions/services";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { formatDuration, formatMoney } from "@/lib/format";
import type { Category, Professional, Service } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TEXT = { active: "Ativo", inactive: "Inativo", archived: "Arquivado" } as const;

export function ServicesManager({
  services,
  categories,
  professionals,
  combos,
  openNew,
}: {
  services: Service[];
  categories: Category[];
  professionals: Professional[];
  combos: Record<string, string[]>;
  openNew?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Service | null | undefined>(openNew ? null : undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [, start] = useTransition();

  const visible = services.filter((s) => showArchived || s.status !== "archived");
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;

  function setStatus(s: Service, status: Service["status"]) {
    start(async () => {
      const res = await setServiceStatusAction(s.id, status);
      if (res.ok) {
        toast.success(status === "active" ? "Serviço ativado." : status === "inactive" ? "Serviço desativado." : "Serviço arquivado.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button onClick={() => setEditing(null)}>
          <Plus /> Novo serviço
        </Button>
        <Button variant="outline" onClick={() => setCatOpen(true)}>
          <Tags /> Categorias
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="accent-[#b68d40]" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Mostrar arquivados
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title="Nenhum serviço cadastrado"
          description="Cadastre seus serviços com valor e duração. Eles aparecerão automaticamente no site e no agendamento online."
          action={
            <Button onClick={() => setEditing(null)}>
              <Plus /> Cadastrar primeiro serviço
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((s) => (
            <div key={s.id} className={cn("card-premium flex gap-4 p-4 sm:p-5", s.status !== "active" && "opacity-70")}>
              {s.image_url ? (
                <div className="relative size-20 shrink-0 overflow-hidden rounded-xl">
                  <Image src={s.image_url} alt="" fill sizes="80px" className="object-cover" />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-lg leading-tight text-ink">{s.name}</p>
                  {s.is_combo ? <Badge className="bg-cream text-gold-dark ring-champagne/40">Combo</Badge> : null}
                  {s.status !== "active" ? <Badge className="bg-zinc-100 text-zinc-600 ring-zinc-200">{STATUS_TEXT[s.status]}</Badge> : null}
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {catName(s.category_id) ?? "Sem categoria"}
                  {!s.show_online ? " · somente interno" : ""}
                </p>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="font-semibold text-gold-dark">{formatMoney(s.price_cents)}</span>
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Clock className="size-3.5" /> {formatDuration(s.duration_minutes)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="soft" onClick={() => setEditing(s)}>
                    <Pencil /> Editar
                  </Button>
                  {s.status === "active" ? (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(s, "inactive")}>
                      <EyeOff /> Desativar
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(s, "active")}>
                      {s.status === "archived" ? <Power /> : <Eye />} Ativar
                    </Button>
                  )}
                  {s.status !== "archived" ? (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(s, "archived")}>
                      <Archive /> Arquivar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        {editing !== undefined ? (
          <DialogContent title={editing ? "Editar serviço" : "Novo serviço"} className="sm:max-w-xl">
            <ServiceForm
              service={editing}
              comboItems={editing ? combos[editing.id] : []}
              categories={categories}
              professionals={professionals}
              allServices={services}
              onDone={() => setEditing(undefined)}
            />
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent title="Categorias" description="Crie categorias ao cadastrar um serviço. Aqui você pode renomear ou excluir.">
          {categories.length === 0 ? <p className="text-sm text-muted">Nenhuma categoria ainda.</p> : null}
          <div className="space-y-2">
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      <Button
        size="sm"
        variant="soft"
        className="h-11"
        disabled={pending || name === category.name}
        onClick={() =>
          start(async () => {
            const r = await renameCategoryAction(category.id, name);
            if (r.ok) {
              toast.success("Categoria atualizada.");
              router.refresh();
            } else toast.error(r.error);
          })
        }
      >
        Salvar
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Excluir categoria"
        disabled={pending}
        onClick={() =>
          confirm(`Excluir a categoria "${category.name}"? Os serviços ficarão sem categoria.`) &&
          start(async () => {
            const r = await deleteCategoryAction(category.id);
            if (r.ok) router.refresh();
            else toast.error(r.error);
          })
        }
      >
        <Trash2 />
      </Button>
    </div>
  );
}
