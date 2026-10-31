import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { AppointmentForm } from "@/components/admin/appointment-form";
import { requireAdmin } from "@/lib/auth";
import { getProfessionals } from "@/lib/admin-data";
import { centsToInput, todayKey } from "@/lib/format";
import type { Service } from "@/lib/types";

export const metadata: Metadata = { title: "Novo agendamento" };

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; data?: string; hora?: string; servico?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireAdmin();
  const [{ data: services }, professionals] = await Promise.all([
    ctx.supabase.from("services").select("*").eq("business_id", ctx.business.id).neq("status", "archived").order("name"),
    getProfessionals(ctx),
  ]);
  let client = null;
  if (sp.cliente) {
    const { data } = await ctx.supabase.from("clients").select("id, full_name, phone").eq("id", sp.cliente).maybeSingle();
    client = data;
  }
  const svc = (services ?? []).find((s: Service) => s.id === sp.servico) as Service | undefined;

  return (
    <>
      <PageHeader title="Novo agendamento" description="Agendamento manual pelo painel." />
      {(services ?? []).length === 0 ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cadastre pelo menos um serviço antes de criar agendamentos.
        </p>
      ) : (
        <AppointmentForm
          services={(services ?? []) as Service[]}
          professionals={professionals}
          tz={ctx.business.timezone}
          initial={{
            serviceId: svc?.id ?? "",
            client,
            professionalId: "",
            date: /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? sp.data! : todayKey(ctx.business.timezone),
            time: /^\d{2}:\d{2}$/.test(sp.hora ?? "") ? sp.hora! : "",
            status: "confirmed",
            price: svc ? centsToInput(svc.price_cents) : "",
            notes: "",
          }}
        />
      )}
    </>
  );
}
