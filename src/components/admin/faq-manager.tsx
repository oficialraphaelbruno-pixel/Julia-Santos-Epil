"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, HelpCircle, Loader2, MessageCircleQuestion, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  deleteFaqItemAction,
  dismissAssistantQuestionAction,
  moveFaqItemAction,
  saveFaqItemAction,
  setFaqPublishedAction,
} from "@/app/admin/actions/assistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FAQ_CATEGORIES, FAQ_CATEGORY_LABEL, type FaqCategory, type FaqItem } from "@/lib/faq-content";

export interface UnansweredQuestion {
  id: number;
  question: string;
  when: string;
}

type Draft = { id?: string; category: FaqCategory; question: string; answer: string; published: boolean; fromLog?: number };

export function FaqManager({ items, unanswered, canEdit }: { items: FaqItem[]; unanswered: UnansweredQuestion[]; canEdit: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="space-y-8">
      {unanswered.length ? (
        <div className="card-premium p-5 sm:p-6" data-testid="unanswered">
          <p className="flex items-center gap-2 font-display text-lg text-ink">
            <MessageCircleQuestion className="size-5 text-gold" /> Perguntas que a assistente não soube responder
          </p>
          <p className="mt-1 text-[13px] text-muted">Responda no FAQ e ela passa a saber. A lista mostra os últimos 30 dias.</p>
          <ul className="mt-4 divide-y divide-line/70">
            {unanswered.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-ink">“{u.question}”</p>
                  <p className="text-[12px] text-muted">{u.when}</p>
                </div>
                {canEdit ? (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDraft({ category: "outros", question: u.question.slice(0, 200), answer: "", published: true, fromLog: u.id })}
                      data-testid="responder-pergunta"
                    >
                      <Plus /> Responder no FAQ
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Remover da lista" onClick={() => run(() => dismissAssistantQuestionAction(u.id))} disabled={pending}>
                      <X />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl text-ink">Perguntas escritas por você</p>
            <p className="text-[13px] text-muted">Aparecem na página Dúvidas e a assistente usa como base.</p>
          </div>
          {canEdit ? (
            <Button onClick={() => setDraft({ category: "outros", question: "", answer: "", published: true })} data-testid="nova-pergunta">
              <Plus /> Nova pergunta
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <EmptyState icon={<HelpCircle />} title="Nenhuma pergunta escrita ainda" description="As respostas automáticas abaixo já aparecem no site. Adicione aqui outras dúvidas que as clientes costumam ter." />
        ) : (
          <div className="space-y-6" data-testid="faq-list">
            {FAQ_CATEGORIES.map((c) => {
              const list = items.filter((i) => i.category === c.key);
              if (!list.length) return null;
              return (
                <div key={c.key}>
                  <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.16em] text-gold-dark">{c.label}</p>
                  <ul className="card-premium divide-y divide-line/70 overflow-hidden">
                    {list.map((f, idx) => (
                      <li key={f.id} className="flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5" data-testid={`faq-row-${f.question}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-ink">
                            {f.question}{" "}
                            {!f.published ? <Badge className="ml-1 bg-zinc-100 text-zinc-600 ring-zinc-200">Escondida</Badge> : null}
                          </p>
                          <p className="mt-1 line-clamp-2 whitespace-pre-line text-[13px] text-muted">{f.answer}</p>
                        </div>
                        {canEdit ? (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button size="icon" variant="ghost" aria-label="Subir" disabled={pending || idx === 0} onClick={() => run(() => moveFaqItemAction(f.id, "up"))}>
                              <ArrowUp />
                            </Button>
                            <Button size="icon" variant="ghost" aria-label="Descer" disabled={pending || idx === list.length - 1} onClick={() => run(() => moveFaqItemAction(f.id, "down"))}>
                              <ArrowDown />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={f.published ? "Esconder do site" : "Publicar no site"}
                              disabled={pending}
                              onClick={() => run(() => setFaqPublishedAction(f.id, !f.published))}
                            >
                              {f.published ? <EyeOff /> : <Eye />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Editar"
                              onClick={() => setDraft({ id: f.id, category: f.category, question: f.question, answer: f.answer, published: f.published })}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Excluir"
                              disabled={pending}
                              onClick={() => {
                                if (confirm("Excluir esta pergunta?")) run(() => deleteFaqItemAction(f.id));
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={draft !== null} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent title={draft?.id ? "Editar pergunta" : "Nova pergunta"} description="Escreva do jeito que você responderia para uma cliente.">
          {draft ? <FaqForm draft={draft} onDone={() => setDraft(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FaqForm({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState<FaqCategory>(draft.category);
  const [question, setQuestion] = useState(draft.question);
  const [answer, setAnswer] = useState(draft.answer);
  const [published, setPublished] = useState(draft.published);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4 overflow-y-auto px-6 py-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveFaqItemAction({ id: draft.id ?? null, category, question, answer, published });
          if (r.ok) {
            if (draft.fromLog) await dismissAssistantQuestionAction(draft.fromLog);
            toast.success(r.message ?? "Salvo.");
            router.refresh();
            onDone();
          } else {
            setErrors(r.fieldErrors ?? {});
            toast.error(r.error);
          }
        });
      }}
    >
      <Field label="Assunto" htmlFor="faq-cat">
        <Select id="faq-cat" value={category} onChange={(e) => setCategory(e.target.value as FaqCategory)}>
          {FAQ_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {FAQ_CATEGORY_LABEL[c.key]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Pergunta" htmlFor="faq-q" error={errors.question}>
        <Input id="faq-q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} placeholder="Ex.: Posso fazer epilação menstruada?" />
      </Field>
      <Field label="Resposta" htmlFor="faq-a" error={errors.answer}>
        <Textarea id="faq-a" rows={7} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={3000} />
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-3 text-sm">
        <span className="text-ink">Mostrar no site e para a assistente</span>
        <Switch checked={published} onCheckedChange={setPublished} aria-label="Publicada" />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending} data-testid="salvar-pergunta">
          {pending ? <Loader2 className="animate-spin" /> : null} Salvar
        </Button>
      </div>
    </form>
  );
}
