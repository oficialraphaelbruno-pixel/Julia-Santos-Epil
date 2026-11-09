"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, Paperclip, Pencil, Plus, Receipt, Trash2, Undo2 } from "lucide-react";
import {
  deleteExpenseAction,
  deleteIncomeAction,
  receiptUrlAction,
  saveExpenseAction,
  saveIncomeAction,
  setExpensePaidAction,
  uploadReceiptAction,
  type ExpenseInput,
} from "@/app/admin/actions/finance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { centsToInput, formatDateKey, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export const EXPENSE_CATEGORIES = [
  "Produtos e materiais",
  "Aluguel",
  "Água, luz e internet",
  "Marketing e divulgação",
  "Impostos e taxas",
  "Taxas de cartão",
  "Equipamentos",
  "Cursos e capacitação",
  "Transporte",
  "Outros",
];

export interface ExpenseRow {
  id: string;
  description: string;
  category: string;
  amount_cents: number;
  due_date: string;
  paid_at: string | null;
  method: PaymentMethod | null;
  supplier: string | null;
  notes: string | null;
  receipt_path: string | null;
  recurrence_group: string | null;
}

export interface IncomeRow {
  id: string;
  kind: "pagamento" | "estorno";
  method: PaymentMethod;
  amount_cents: number;
  paid_at: string;
  description: string | null;
  notes: string | null;
  appointment_id: string | null;
  label: string;
  date_key: string;
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? "Feito.");
        after?.();
        router.refresh();
      } else toast.error(r.error);
    });
  return { pending, run };
}

export function FinanceActions({ today }: { today: string }) {
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setExpenseOpen(true)} data-testid="nova-despesa">
        <Plus /> Nova despesa
      </Button>
      <Button size="sm" variant="outline" onClick={() => setIncomeOpen(true)} data-testid="nova-receita">
        <Plus /> Receita avulsa
      </Button>
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        {expenseOpen ? (
          <DialogContent title="Nova despesa" className="sm:max-w-xl">
            <ExpenseForm today={today} onDone={() => setExpenseOpen(false)} />
          </DialogContent>
        ) : null}
      </Dialog>
      <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
        {incomeOpen ? (
          <DialogContent title="Receita avulsa" description="Ex.: venda de produto, vale-presente. Pagamentos de atendimentos são lançados no próprio agendamento.">
            <IncomeForm today={today} onDone={() => setIncomeOpen(false)} />
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

function ExpenseForm({ expense, today, onDone }: { expense?: ExpenseRow; today: string; onDone: () => void }) {
  const { pending, run } = useRun();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState<ExpenseInput>({
    id: expense?.id ?? null,
    description: expense?.description ?? "",
    category: expense?.category ?? "Produtos e materiais",
    amount: expense ? centsToInput(expense.amount_cents) : "",
    dueDate: expense?.due_date ?? today,
    paid: expense ? Boolean(expense.paid_at) : true,
    paidAt: expense?.paid_at ?? today,
    method: expense?.method ?? "pix",
    supplier: expense?.supplier ?? "",
    notes: expense?.notes ?? "",
    receiptPath: expense?.receipt_path ?? null,
    repeatMonths: 1,
  });

  return (
    <div className="space-y-4">
      <Field label="Descrição *" htmlFor="ex-desc" error={errors.description}>
        <Input id="ex-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: Cera depilatória 1 kg" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria *" htmlFor="ex-cat" error={errors.category}>
          <Input id="ex-cat" list="ex-cats" value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} />
          <datalist id="ex-cats">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Valor (R$) *" htmlFor="ex-amount" error={errors.amount}>
          <Input id="ex-amount" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="0,00" />
        </Field>
        <Field label="Vencimento *" htmlFor="ex-due" error={errors.dueDate}>
          <Input id="ex-due" type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} />
        </Field>
        <Field label="Fornecedor (opcional)" htmlFor="ex-sup">
          <Input id="ex-sup" value={v.supplier} onChange={(e) => setV({ ...v, supplier: e.target.value })} />
        </Field>
      </div>

      <div className="space-y-3 rounded-2xl bg-ivory p-4">
        <label className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium">Já está paga</span>
          <Switch checked={v.paid} onCheckedChange={(c) => setV({ ...v, paid: c })} />
        </label>
        {v.paid ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data do pagamento" htmlFor="ex-paidat">
              <Input id="ex-paidat" type="date" value={v.paidAt} onChange={(e) => setV({ ...v, paidAt: e.target.value })} />
            </Field>
            <Field label="Forma de pagamento" htmlFor="ex-method">
              <Select id="ex-method" value={v.method} onChange={(e) => setV({ ...v, method: e.target.value as PaymentMethod })}>
                {Object.entries(PAYMENT_METHOD_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
        {!expense ? (
          <Field label="Repetir todo mês (despesa fixa)" htmlFor="ex-repeat" hint="Ex.: aluguel. Cria as próximas parcelas como “a pagar”.">
            <Select id="ex-repeat" value={String(v.repeatMonths)} onChange={(e) => setV({ ...v, repeatMonths: Number(e.target.value) })}>
              <option value="1">Não repetir</option>
              {[2, 3, 6, 12, 24].map((n) => (
                <option key={n} value={n}>
                  Por {n} meses
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-medium text-ink/80">Comprovante / nota fiscal (opcional)</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            const fd = new FormData();
            fd.append("file", file);
            const r = await uploadReceiptAction(fd);
            setUploading(false);
            e.target.value = "";
            if (r.ok && r.data) {
              setV((cur) => ({ ...cur, receiptPath: r.data!.path }));
              toast.success("Comprovante anexado.");
            } else if (!r.ok) toast.error(r.error);
          }}
        />
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" /> : <Paperclip />} {v.receiptPath ? "Trocar arquivo" : "Anexar foto ou PDF"}
          </Button>
          {v.receiptPath ? (
            <span className="inline-flex items-center gap-1 text-[13px] text-emerald-700">
              <CheckCircle2 className="size-4" /> anexado
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[12px] text-muted">Guardado em área privada: só a proprietária consegue abrir.</p>
      </div>

      <Field label="Observações" htmlFor="ex-notes">
        <Textarea id="ex-notes" rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </Field>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          className="flex-1"
          disabled={pending || uploading}
          data-testid="salvar-despesa"
          onClick={() =>
            run(
              async () => {
                setErrors({});
                const r = await saveExpenseAction(v);
                if (!r.ok) setErrors(r.fieldErrors ?? {});
                return r;
              },
              onDone,
            )
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : null} Salvar despesa
        </Button>
      </div>
    </div>
  );
}

function IncomeForm({ today, onDone }: { today: string; onDone: () => void }) {
  const { pending, run } = useRun();
  const [v, setV] = useState({ description: "", amount: "", method: "pix" as PaymentMethod, date: today });
  return (
    <div className="space-y-4">
      <Field label="Descrição *" htmlFor="in-desc">
        <Input id="in-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="Ex.: Venda de óleo pós-depilação" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Valor (R$) *" htmlFor="in-amount">
          <Input id="in-amount" inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} />
        </Field>
        <Field label="Data" htmlFor="in-date">
          <Input id="in-date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        </Field>
        <Field label="Forma" htmlFor="in-method">
          <Select id="in-method" value={v.method} onChange={(e) => setV({ ...v, method: e.target.value as PaymentMethod })}>
            {Object.entries(PAYMENT_METHOD_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onDone}>
          Cancelar
        </Button>
        <Button className="flex-1" disabled={pending} data-testid="salvar-receita" onClick={() => run(() => saveIncomeAction(v), onDone)}>
          {pending ? <Loader2 className="animate-spin" /> : null} Lançar receita
        </Button>
      </div>
    </div>
  );
}

export function ExpenseList({ expenses, today, title, empty }: { expenses: ExpenseRow[]; today: string; title: string; empty: string }) {
  const { pending, run } = useRun();
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  async function openReceipt(path: string) {
    const r = await receiptUrlAction(path);
    if (r.ok && r.data) window.open(r.data.url, "_blank", "noopener,noreferrer");
    else if (!r.ok) toast.error(r.error);
  }

  return (
    <div className="card-premium p-5 sm:p-6" data-testid={`lista-${title}`}>
      <p className="mb-3 font-display text-lg">{title}</p>
      {expenses.length === 0 ? <p className="py-4 text-center text-sm text-muted">{empty}</p> : null}
      <ul className="divide-y divide-line/70">
        {expenses.map((e) => {
          const overdue = !e.paid_at && e.due_date < today;
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-3 py-3 text-sm" data-testid={`despesa-${e.description}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">
                  {e.description}
                  {e.recurrence_group ? <span className="ml-1.5 text-[11px] text-muted">(fixa)</span> : null}
                </p>
                <p className="text-[12.5px] text-muted">
                  {e.category} · vence {formatDateKey(e.due_date)}
                  {e.supplier ? ` · ${e.supplier}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums text-ink">{formatMoney(e.amount_cents)}</p>
                <p className={cn("text-[12px]", e.paid_at ? "text-emerald-700" : overdue ? "font-medium text-rose-700" : "text-amber-700")}>
                  {e.paid_at ? `Paga em ${formatDateKey(e.paid_at)}` : overdue ? "Vencida" : "A pagar"}
                </p>
              </div>
              <div className="flex gap-1">
                {e.receipt_path ? (
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Ver comprovante" onClick={() => openReceipt(e.receipt_path!)}>
                    <FileText />
                  </Button>
                ) : null}
                {e.paid_at ? (
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Desfazer pagamento" disabled={pending} onClick={() => run(() => setExpensePaidAction(e.id, false))}>
                    <Undo2 />
                  </Button>
                ) : (
                  <Button size="sm" variant="soft" disabled={pending} onClick={() => run(() => setExpensePaidAction(e.id, true, today))} data-testid="pagar-despesa">
                    <CheckCircle2 /> Pagar
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="size-8" aria-label="Editar" onClick={() => setEditing(e)}>
                  <Pencil />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Excluir"
                  disabled={pending}
                  onClick={() => {
                    if (e.recurrence_group && !e.paid_at && confirm("Despesa fixa: excluir também as próximas parcelas não pagas?\n(OK = esta e as próximas · Cancelar = escolher só esta)")) {
                      run(() => deleteExpenseAction(e.id, true));
                    } else if (confirm(`Excluir "${e.description}"?`)) run(() => deleteExpenseAction(e.id));
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        {editing ? (
          <DialogContent title="Editar despesa" className="sm:max-w-xl">
            <ExpenseForm expense={editing} today={today} onDone={() => setEditing(null)} />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

export function IncomeList({ incomes }: { incomes: IncomeRow[] }) {
  const { pending, run } = useRun();
  return (
    <div className="card-premium p-5 sm:p-6" data-testid="lista-receitas">
      <p className="mb-3 font-display text-lg">Receitas do mês</p>
      {incomes.length === 0 ? <p className="py-4 text-center text-sm text-muted">Nenhuma receita registrada neste mês.</p> : null}
      <ul className="divide-y divide-line/70">
        {incomes.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-3 text-sm">
            <Receipt className={cn("size-4 shrink-0", p.kind === "estorno" ? "text-rose-600" : "text-gold")} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{p.label}</p>
              <p className="text-[12.5px] text-muted">
                {formatDateKey(p.date_key)} · {PAYMENT_METHOD_LABEL[p.method]}
                {p.kind === "estorno" ? " · estorno" : ""}
              </p>
            </div>
            <span className={cn("font-semibold tabular-nums", p.kind === "estorno" ? "text-rose-700" : "text-emerald-800")}>
              {p.kind === "estorno" ? "−" : "+"}
              {formatMoney(p.amount_cents)}
            </span>
            {!p.appointment_id ? (
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Excluir receita"
                disabled={pending}
                onClick={() => confirm("Excluir esta receita avulsa?") && run(() => deleteIncomeAction(p.id))}
              >
                <Trash2 />
              </Button>
            ) : (
              <span className="size-8" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
