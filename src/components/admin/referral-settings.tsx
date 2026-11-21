"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveReferralProgramAction } from "@/app/admin/actions/referrals";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { centsToInput, parseMoneyToCents } from "@/lib/format";
import type { ReferralProgram } from "@/lib/public-data";

function toInput(type: string, value: number) {
  return type === "percent" ? String(value) : centsToInput(value);
}
function fromInput(type: string, value: string) {
  return type === "percent" ? Number(value.replace(",", ".")) || 0 : (parseMoneyToCents(value) ?? 0);
}

export function ReferralSettings({ program, canEdit }: { program: ReferralProgram; canEdit: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(program.enabled);
  const [rewardType, setRewardType] = useState(program.reward_type);
  const [rewardValue, setRewardValue] = useState(toInput(program.reward_type, program.reward_value));
  const [friendType, setFriendType] = useState(program.friend_type);
  const [friendValue, setFriendValue] = useState(toInput(program.friend_type, program.friend_value));
  const [validDays, setValidDays] = useState(program.reward_valid_days ? String(program.reward_valid_days) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <form
      className="card-premium space-y-5 p-5 sm:p-6"
      data-testid="referral-settings"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveReferralProgramAction({
            enabled,
            rewardType,
            rewardValue: fromInput(rewardType, rewardValue),
            friendType,
            friendValue: fromInput(friendType, friendValue),
            validDays: validDays ? Number(validDays) : "",
          });
          if (r.ok) {
            toast.success(r.message ?? "Salvo.");
            router.refresh();
          } else {
            setErrors(r.fieldErrors ?? {});
            toast.error(r.error);
          }
        });
      }}
    >
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-ivory p-4">
        <span>
          <span className="block font-medium text-ink">Programa de indicação ativo</span>
          <span className="text-[13px] text-muted">Mostra o link pessoal para as clientes e aceita indicações no agendamento.</span>
        </span>
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!canEdit} aria-label="Programa ativo" data-testid="referral-enabled" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Quem indica ganha (no próximo agendamento)</p>
          <div className="flex gap-2">
            <Select value={rewardType} onChange={(e) => setRewardType(e.target.value as "percent" | "fixed")} disabled={!canEdit} className="max-w-36" aria-label="Tipo do desconto de quem indica">
              <option value="percent">%</option>
              <option value="fixed">R$</option>
            </Select>
            <Input inputMode="decimal" value={rewardValue} onChange={(e) => setRewardValue(e.target.value)} disabled={!canEdit} id="ref-reward" aria-label="Valor" />
          </div>
          {errors.rewardValue ? <p className="mt-1 text-[13px] text-rose-600">{errors.rewardValue}</p> : null}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">A amiga indicada ganha (opcional)</p>
          <div className="flex gap-2">
            <Select value={friendType} onChange={(e) => setFriendType(e.target.value as "percent" | "fixed")} disabled={!canEdit} className="max-w-36" aria-label="Tipo do desconto da amiga">
              <option value="percent">%</option>
              <option value="fixed">R$</option>
            </Select>
            <Input inputMode="decimal" value={friendValue} onChange={(e) => setFriendValue(e.target.value)} disabled={!canEdit} id="ref-friend" aria-label="Valor" />
          </div>
          <p className="mt-1 text-[12.5px] text-muted">Use 0 para não dar desconto à amiga. Vale só no primeiro agendamento dela.</p>
          {errors.friendValue ? <p className="text-[13px] text-rose-600">{errors.friendValue}</p> : null}
        </div>
      </div>

      <Field label="Validade do desconto de quem indica (dias)" htmlFor="ref-days" error={errors.validDays} hint="Em branco = sem prazo.">
        <Input id="ref-days" inputMode="numeric" value={validDays} onChange={(e) => setValidDays(e.target.value.replace(/\D/g, ""))} disabled={!canEdit} className="max-w-40" />
      </Field>

      <ul className="list-disc space-y-1 rounded-2xl bg-ivory p-4 pl-8 text-[13px] text-ink/75">
        <li>A amiga precisa ser cliente nova (WhatsApp e e-mail ainda não cadastrados) e ninguém indica a si mesma.</li>
        <li>O desconto de quem indicou é liberado quando a amiga comparece (atendimento marcado como concluído).</li>
        <li>O desconto é aplicado sozinho no próximo agendamento online de quem indicou. Se esse agendamento for cancelado, o desconto volta.</li>
        <li>Descontos de indicação não acumulam com cupom.</li>
      </ul>

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending} data-testid="salvar-indicacao">
            {pending ? <Loader2 className="animate-spin" /> : null} Salvar programa
          </Button>
        </div>
      ) : null}
    </form>
  );
}
