"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ChevronDown, ChevronUp, Clock, Eye, EyeOff, Pencil, Plus, Power, Sparkles, Tags, Trash2 } from "lucide-react";
import { ServiceForm } from "@/components/admin/service-form";
import { deleteCategoryAction, moveCategoryAction, moveServiceAction, renameCategoryAction, setServiceStatusAction } from "@/app/admin/actions/services";
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
  const [pending, start] = useTransition();

  const visible = services.filter((s) => showArchived || s.status !== "archived");
  // Mesma ordem do site: categorias por posição; serviços por posição dentro da categoria.
  const groups = [
    ...categories.map((c, index) => ({ key: c.id, title: c.name, categoryId: c.id as string | null, index, items: visible.filter((s) => s.category_id === c.id) })),
    {
      key: "sem-categoria",
      title: categories.length ? "Outros serviços" : "Serviços",
      categoryId: null as string | null,
      index: categories.length,
      items: visible.filter((s) => !s.category_id || !categories.some((c) => c.id === s.category_id)),
    },
  ].filter((g) => g.items.length);
  const categoryGroupsCount = categories.length;
  const moveSvc = (id: string, dir: "up" | "down") =>
    start(async () => {
      const r = await moveServiceAction(id, dir);
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  const moveCat = (id: string, dir: "up" | "down") =>
    start(async () => {
      const r = await moveCategoryAction(id, dir);
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
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
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key} data-testid={`grupo-${g.title}`}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-display text-xl text-gold-dark">{g.title}</h2>
                <span className="text-[13px] text-muted">({g.items.length})</span>
                {g.categoryId && categories.length > 1 ? (
                  <span className="ml-auto flex gap-1">
                    <Button size="icon" variant="ghost" className="size-8" aria-label={`Subir categoria ${g.title}`} disabled={pending || g.index === 0} onClick={() => moveCat(g.categoryId!, "up")}>
                      <ChevronUp />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8" aria-label={`Descer categoria ${g.title}`} disabled={pending || g.index === categoryGroupsCount - 1} onClick={() => moveCat(g.categoryId!, "down")}>
                      <ChevronDown />
                    </Button>
                  </span>
                ) : null}
              </div>
              <div className="card-premium divide-y divide-line/70 overflow-hidden">
                {g.items.map((s, idx) => (
                  <div key={s.id} className={cn("flex items-center gap-3 p-3 sm:gap-4 sm:p-4", s.status !== "active" && "opacity-70")} data-testid={`servico-${s.name}`}>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        className="grid size-8 place-items-center rounded-lg text-gold-dark transition hover:bg-ivory disabled:opacity-25"
                        aria-label={`Mover ${s.name} para cima`}
                        disabled={pending || idx === 0 || s.status === "archived"}
                        onClick={() => moveSvc(s.id, "up")}
                      >
                        <ChevronUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="grid size-8 place-items-center rounded-lg text-gold-dark transition hover:bg-ivory disabled:opacity-25"
                        aria-label={`Mover ${s.name} para baixo`}
                        disabled={pending || idx === g.items.length - 1 || s.status === "archived"}
                        onClick={() => moveSvc(s.id, "down")}
                      >
                        <ChevronDown className="size-4" />
                      </button>
                    </div>
                    {s.image_url ? (
                      <div className="relative hidden size-14 shrink-0 overflow-hidden rounded-xl sm:block">
                        <Image src={s.image_url} alt="" fill sizes="56px" className="object-cover" />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-ink">{s.name}</p>
                        {s.is_combo ? <Badge className="bg-cream text-gold-dark ring-champagne/40">Combo</Badge> : null}
                        {s.status !== "active" ? <Badge className="bg-zinc-100 text-zinc-600 ring-zinc-200">{STATUS_TEXT[s.status]}</Badge> : null}
                        {!s.show_online ? <Badge className="bg-zinc-100 text-zinc-600 ring-zinc-200">Só interno</Badge> : null}
                      </div>
                      <p className="mt-0.5 flex items-center gap-3 text-[13px] text-muted">
                        <span className="font-semibold text-gold-dark">{formatMoney(s.price_cents)}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" /> {formatDuration(s.duration_minutes)}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="soft" onClick={() => setEditing(s)}>
                        <Pencil /> <span className="hidden sm:inline">Editar</span>
                      </Button>
                      {s.status === "active" ? (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(s, "inactive")} aria-label="Desativar">
                          <EyeOff /> <span className="hidden md:inline">Desativar</span>
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(s, "active")} aria-label="Ativar">
                          {s.status === "archived" ? <Power /> : <Eye />} <span className="hidden md:inline">Ativar</span>
                        </Button>
                      )}
                      {s.status !== "archived" ? (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(s, "archived")} aria-label="Arquivar">
                          <Archive /> <span className="hidden md:inline">Arquivar</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
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
