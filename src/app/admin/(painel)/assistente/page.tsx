import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { AreaLockedNotice } from "@/components/admin/area-locked-notice";
import {
  AssistantSettingsForm,
  type AssistantSettingsRow,
} from "@/components/admin/assistant-settings-form";
import {
  FaqManager,
  type UnansweredQuestion,
} from "@/components/admin/faq-manager";
import { requireAdmin } from "@/lib/auth";
import { AREA_LABEL } from "@/lib/permissions";
import { formatDateTime, localToUtcIso, nowMs, todayKey } from "@/lib/format";
import { getFaqData, openaiConfigured } from "@/lib/faq-data";
import {
  autoAnswers,
  careByService,
  FAQ_CATEGORY_LABEL,
  type FaqItem,
} from "@/lib/faq-content";
import {
  AssistantCreditCard,
  type CreditCardData,
} from "@/components/admin/assistant-credit-card";
import {
  creditStatus,
  estimateCostUsd,
  sumUsage,
  type UsageRow,
} from "@/lib/credit";
import { adminKeyConfigured, fetchOrgCostsUsd } from "@/lib/openai-billing";
import { addDaysKey, formatDateKey } from "@/lib/format";

export const metadata: Metadata = { title: "FAQ e assistente" };

const SOURCE_LINK: Record<string, string> = {
  "Agendamento Online": "/admin/agendamento-online",
  Configurações: "/admin/configuracoes",
};

export default async function AssistantPage() {
  const ctx = await requireAdmin();
  const tz = ctx.business.timezone;
  const since30 = new Date(nowMs() - 30 * 864e5).toISOString();
  const [
    { data: settings },
    { data: items },
    { data: logs },
    { count: today },
    { count: month },
    publicData,
  ] = await Promise.all([
    ctx.supabase
      .from("assistant_settings")
      .select(
        "enabled, name, welcome_message, personality, extra_info, avoid_topics, daily_limit, model",
      )
      .eq("business_id", ctx.business.id)
      .maybeSingle(),
    ctx.supabase
      .from("faq_items")
      .select("id, category, question, answer, sort_order, published")
      .eq("business_id", ctx.business.id)
      .order("sort_order")
      .order("created_at"),
    ctx.supabase
      .from("assistant_logs")
      .select("id, question, created_at")
      .eq("business_id", ctx.business.id)
      .eq("answered", false)
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(50),
    ctx.supabase
      .from("assistant_logs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.business.id)
      .gte("created_at", localToUtcIso(todayKey(tz), "00:00", tz)),
    ctx.supabase
      .from("assistant_logs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", ctx.business.id)
      .gte("created_at", since30),
    getFaqData(ctx.business.id),
  ]);
  const canEdit = ctx.canEdit("assistente");
  const auto = autoAnswers(ctx.business, publicData.settings);
  const pre = careByService(publicData.services, "pre");
  const pos = careByService(publicData.services, "pos");
  // ---- Crédito da OpenAI ----
  const { data: credit } = await ctx.supabase
    .from("assistant_settings")
    .select(
      "credit_usd, credit_since, low_balance_usd, price_input_per_m, price_output_per_m",
    )
    .eq("business_id", ctx.business.id)
    .maybeSingle();
  const todayStr = todayKey(tz);
  const creditSince = (credit?.credit_since as string | null) ?? null;
  const usageFrom =
    creditSince && creditSince < addDaysKey(todayStr, -31)
      ? creditSince
      : addDaysKey(todayStr, -31);
  const { data: usageRows } = await ctx.supabase
    .from("assistant_usage_daily")
    .select("day, messages, prompt_tokens, completion_tokens")
    .eq("business_id", ctx.business.id)
    .gte("day", usageFrom);
  const rows = (usageRows ?? []) as UsageRow[];
  const priceIn = Number(credit?.price_input_per_m ?? 0.15);
  const priceOut = Number(credit?.price_output_per_m ?? 0.6);
  const cost = (u: { prompt: number; completion: number }) =>
    estimateCostUsd(u.prompt, u.completion, priceIn, priceOut);
  const sinceUsage = sumUsage(rows, creditSince ?? addDaysKey(todayStr, -30));
  const estimatedUsd = cost(sinceUsage);
  const real =
    creditSince && adminKeyConfigured()
      ? await fetchOrgCostsUsd(
          Date.parse(localToUtcIso(creditSince, "00:00", tz)) / 1000,
        )
      : null;
  const spentUsd = real?.ok ? real.totalUsd : estimatedUsd;
  const creditUsd =
    credit?.credit_usd === null || credit?.credit_usd === undefined
      ? null
      : Number(credit.credit_usd);
  const status = creditStatus({
    creditUsd,
    spentUsd,
    lowBalanceUsd: Number(credit?.low_balance_usd ?? 2),
  });
  const creditData: CreditCardData = {
    creditUsd,
    creditSince,
    creditSinceLabel: creditSince
      ? formatDateKey(creditSince, "dd/MM/yyyy")
      : null,
    lowBalanceUsd: Number(credit?.low_balance_usd ?? 2),
    priceInput: priceIn,
    priceOutput: priceOut,
    balance: status.balance,
    percentLeft: status.percentLeft,
    level: status.level,
    spentUsd,
    spentSource: real?.ok ? "real" : "estimado",
    estimatedUsd,
    realError: real && !real.ok ? real.error : null,
    todayUsd: cost(sumUsage(rows, todayStr, todayStr)),
    monthUsd: cost(sumUsage(rows, `${todayStr.slice(0, 7)}-01`)),
    messagesSince: sinceUsage.messages,
    adminKey: adminKeyConfigured(),
  };

  const unanswered: UnansweredQuestion[] = (logs ?? []).map((l) => ({
    id: l.id as number,
    question: l.question as string,
    when: formatDateTime(l.created_at as string, tz),
  }));

  return (
    <>
      <PageHeader
        title="FAQ e assistente Mel"
        description="As perguntas frequentes aparecem na página “Dúvidas” do site e são a base de conhecimento da assistente. Ela também usa os serviços (preços e cuidados), as regras do agendamento e o endereço já cadastrados."
      />
      <AreaLockedNotice labels={canEdit ? [] : [AREA_LABEL.assistente]} />

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link
          href="/duvidas"
          target="_blank"
          className="inline-flex items-center gap-1.5 font-medium text-gold-dark hover:underline"
        >
          Ver a página Dúvidas no site <ExternalLink className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <div className="space-y-6">
          {settings ? (
            <AssistantSettingsForm
              settings={settings as AssistantSettingsRow}
              canEdit={canEdit}
              isPlatformAdmin={ctx.isPlatformAdmin}
              keyConfigured={openaiConfigured()}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="card-premium p-4">
              <p className="text-[12.5px] text-muted">Mensagens hoje</p>
              <p
                className="font-display text-2xl text-ink"
                data-testid="mel-uso-hoje"
              >
                {today ?? 0}
                <span className="text-sm text-muted">
                  {" "}
                  / {settings?.daily_limit ?? 0}
                </span>
              </p>
            </div>
            <div className="card-premium p-4">
              <p className="text-[12.5px] text-muted">Mensagens em 30 dias</p>
              <p className="font-display text-2xl text-ink">{month ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <AssistantCreditCard
            data={creditData}
            canEdit={canEdit}
            isPlatformAdmin={ctx.isPlatformAdmin}
            today={todayStr}
          />
          <div
            className="card-premium h-fit p-5 sm:p-6"
            data-testid="auto-answers"
          >
            <p className="flex items-center gap-2 font-display text-lg text-ink">
              <Sparkles className="size-5 text-gold" /> Respostas automáticas
            </p>
            <p className="mt-1 text-[13px] text-muted">
              Montadas com o que já está cadastrado. Para mudar, edite na tela
              indicada: o site e a assistente atualizam sozinhos.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="rounded-2xl bg-ivory p-3">
                <p className="font-medium text-ink">
                  Cuidados antes e depois, por serviço
                </p>
                <p className="text-[13px] text-muted">
                  {pre.length} serviço(s) com orientações de antes e{" "}
                  {pos.length} com orientações de depois.{" "}
                  <Link
                    href="/admin/servicos"
                    className="text-gold-dark underline"
                  >
                    Editar em Serviços
                  </Link>
                </p>
              </li>
              {auto.map((a) => (
                <li key={a.id} className="rounded-2xl bg-ivory p-3">
                  <p className="font-medium text-ink">{a.question}</p>
                  <p className="text-[12px] text-muted">
                    {FAQ_CATEGORY_LABEL[a.category]}
                  </p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] text-ink/75">
                    {a.answer}
                  </p>
                  {SOURCE_LINK[a.source] ? (
                    <Link
                      href={SOURCE_LINK[a.source]}
                      className="mt-1 inline-block text-[13px] text-gold-dark underline"
                    >
                      Editar em {a.source}
                    </Link>
                  ) : null}
                </li>
              ))}
              <li className="rounded-2xl bg-ivory p-3 text-[13px] text-muted">
                A assistente também informa a chave Pix cadastrada em
                Agendamento Online quando perguntam como pagar o sinal.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <FaqManager
          items={(items ?? []) as FaqItem[]}
          unanswered={unanswered}
          canEdit={canEdit}
        />
      </div>
    </>
  );
}
