import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { HoursEditor } from "@/components/admin/hours-editor";
import { BlocksManager, SpecialDaysManager, type BlockRow, type SpecialRow } from "@/components/admin/blocks-manager";
import { requireAdmin } from "@/lib/auth";
import { getProfessionals } from "@/lib/admin-data";
import { todayKey } from "@/lib/format";
import type { WorkingHour } from "@/lib/types";

export const metadata: Metadata = { title: "Horários" };

export default async function HoursPage({ searchParams }: { searchParams: Promise<{ profissional?: string; bloquear?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireAdmin();
  const professionals = await getProfessionals(ctx);
  const prof = professionals.find((p) => p.id === sp.profissional) ?? professionals[0];
  const today = todayKey(ctx.business.timezone);

  if (!prof) {
    return <PageHeader title="Horários" description="Cadastre uma profissional para configurar horários." />;
  }

  const [hours, blocks, specials] = await Promise.all([
    ctx.supabase.from("working_hours").select("*").eq("professional_id", prof.id),
    ctx.supabase
      .from("time_blocks")
      .select("id, kind, starts_at, ends_at, all_day, reason")
      .eq("business_id", ctx.business.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at"),
    ctx.supabase.from("special_days").select("*").eq("professional_id", prof.id).gte("day", today).order("day"),
  ]);
  const hasOpenDay = (hours.data ?? []).some((h: WorkingHour) => h.is_open);

  return (
    <>
      <PageHeader
        title="Horários de funcionamento"
        description={`Defina os dias, horários e intervalo de almoço de ${prof.display_name}. A agenda online usa estas regras.`}
      />
      {!hasOpenDay ? (
        <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Nenhum dia está aberto ainda. Enquanto isso, o agendamento online não exibirá horários.
        </p>
      ) : null}
      <HoursEditor professionalId={prof.id} hours={(hours.data ?? []) as WorkingHour[]} canEdit={ctx.role === "owner"} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <BlocksManager blocks={(blocks.data ?? []) as BlockRow[]} tz={ctx.business.timezone} today={today} openNew={sp.bloquear === "1"} />
        <SpecialDaysManager professionalId={prof.id} days={(specials.data ?? []) as SpecialRow[]} today={today} canEdit={ctx.role === "owner"} />
      </div>
    </>
  );
}
