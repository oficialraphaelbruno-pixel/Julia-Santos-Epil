import type { Metadata } from "next";
import Link from "next/link";
import { Gift } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { AreaLockedNotice } from "@/components/admin/area-locked-notice";
import { ReferralSettings } from "@/components/admin/referral-settings";
import { ReferralRewardButton } from "@/components/admin/referral-reward-button";
import { EmptyState } from "@/components/ui/empty";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { AREA_LABEL } from "@/lib/permissions";
import { discountText } from "@/lib/coupon-code";
import type { ReferralProgram } from "@/lib/public-data";

export const metadata: Metadata = { title: "Indicações" };

interface Row {
  id: string;
  status: "pending" | "qualified" | "cancelled";
  created_at: string;
  qualified_at: string | null;
  referrer: { id: string; full_name: string } | null;
  referred: { id: string; full_name: string } | null;
  reward: Reward | Reward[] | null;
}
interface Reward {
  id: string; status: "available" | "used" | "cancelled"; discount_type: string; discount_value: number; expires_at: string | null; used: { reference_code: string; id: string } | null;
}

const STATUS: Record<Row["status"], [string, string]> = {
  pending: ["Aguardando a amiga comparecer", "bg-amber-50 text-amber-800"],
  qualified: ["Amiga compareceu", "bg-emerald-50 text-emerald-800"],
  cancelled: ["Cancelada", "bg-zinc-100 text-zinc-600"],
};

/** referral_id é único: o PostgREST devolve objeto (ou lista, conforme a versão). */
function rewardOf(r: Row): Reward | null {
  return Array.isArray(r.reward) ? (r.reward[0] ?? null) : r.reward;
}

function isExpired(iso: string | null) {
  return Boolean(iso) && Date.parse(iso as string) < Date.now();
}

export default async function ReferralsPage() {
  const ctx = await requireAdmin();
  const tz = ctx.business.timezone;
  const [{ data: program }, { data: rows }] = await Promise.all([
    ctx.supabase
      .from("referral_programs")
      .select("enabled, reward_type, reward_value, friend_type, friend_value, reward_valid_days")
      .eq("business_id", ctx.business.id)
      .maybeSingle(),
    ctx.supabase
      .from("referrals")
      .select(
        "id, status, created_at, qualified_at, referrer:clients!referrals_business_id_referrer_client_id_fkey(id, full_name), referred:clients!referrals_business_id_referred_client_id_fkey(id, full_name), reward:referral_rewards(id, status, discount_type, discount_value, expires_at, used:appointments!referral_rewards_used_appointment_id_fkey(id, reference_code))",
      )
      .eq("business_id", ctx.business.id)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const list = (rows ?? []) as unknown as Row[];
  const qualified = list.filter((r) => r.status === "qualified").length;
  const canEdit = ctx.canEdit("indicacoes");

  return (
    <>
      <PageHeader title="Indicações" description="Cada cliente tem um link pessoal. Quando uma amiga nova agenda por ele e comparece, quem indicou ganha desconto no próximo agendamento." />
      <AreaLockedNotice labels={canEdit ? [] : [AREA_LABEL.indicacoes]} />
      {program ? <ReferralSettings program={program as ReferralProgram} canEdit={canEdit} /> : null}

      <div className="mt-8 grid grid-cols-3 gap-3">
        {[
          ["Indicações", list.length],
          ["Amigas que compareceram", qualified],
          ["Descontos disponíveis", list.filter((r) => rewardOf(r)?.status === "available").length],
        ].map(([label, value]) => (
          <div key={label as string} className="card-premium p-4">
            <p className="text-[12.5px] text-muted">{label}</p>
            <p className="font-display text-2xl text-ink">{value}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl">Histórico de indicações</h2>
      {list.length === 0 ? (
        <EmptyState icon={<Gift />} title="Nenhuma indicação ainda" description="As indicações aparecem aqui assim que uma amiga agendar pelo link de uma cliente." />
      ) : (
        <div className="card-premium divide-y divide-line/70 overflow-hidden" data-testid="referral-list">
          {list.map((r) => {
            const reward = rewardOf(r);
            const expired = reward?.status === "available" && isExpired(reward.expires_at);
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-sm sm:px-6">
                <div className="min-w-0">
                  <p className="text-ink">
                    {r.referrer ? (
                      <Link href={`/admin/clientes/${r.referrer.id}`} className="font-medium hover:underline">
                        {r.referrer.full_name}
                      </Link>
                    ) : (
                      "—"
                    )}{" "}
                    indicou{" "}
                    {r.referred ? (
                      <Link href={`/admin/clientes/${r.referred.id}`} className="font-medium hover:underline">
                        {r.referred.full_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </p>
                  <p className="text-[12.5px] text-muted">
                    {formatDate(r.created_at, tz)} · <span className={`rounded-full px-2 py-0.5 ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 text-right text-[13px]">
                  {reward ? (
                    <span>
                      {discountText(reward.discount_type, reward.discount_value)} ·{" "}
                      {reward.status === "used" && reward.used ? (
                        <Link href={`/admin/agenda/${reward.used.id}`} className="text-gold-dark underline">
                          usado em {reward.used.reference_code}
                        </Link>
                      ) : reward.status === "cancelled" ? (
                        "cancelado"
                      ) : expired ? (
                        "vencido"
                      ) : (
                        `disponível${reward.expires_at ? ` até ${formatDate(reward.expires_at, tz)}` : ""}`
                      )}
                    </span>
                  ) : (
                    <span className="text-muted">sem desconto ainda</span>
                  )}
                  {reward && reward.status !== "used" && canEdit ? <ReferralRewardButton rewardId={reward.id} status={reward.status} /> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
