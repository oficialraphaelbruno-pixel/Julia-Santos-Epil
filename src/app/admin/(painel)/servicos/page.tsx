import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { ServicesManager } from "@/components/admin/services-manager";
import { requireAdmin } from "@/lib/auth";
import type { Category, Professional, Service } from "@/lib/types";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ novo?: string }> }) {
  const { novo } = await searchParams;
  const { supabase, business, role } = await requireAdmin();
  const [services, categories, professionals, combos] = await Promise.all([
    supabase.from("services").select("*").eq("business_id", business.id).order("sort_order").order("name"),
    supabase.from("service_categories").select("id, name, sort_order").eq("business_id", business.id).order("sort_order").order("name"),
    supabase.from("professionals").select("id, display_name, active").eq("business_id", business.id).order("created_at"),
    supabase.from("service_combo_items").select("combo_id, service_id").eq("business_id", business.id),
  ]);
  const comboMap: Record<string, string[]> = {};
  for (const c of combos.data ?? []) (comboMap[c.combo_id] ??= []).push(c.service_id);

  return (
    <>
      <PageHeader
        title="Serviços"
        description="Valor e duração são usados automaticamente na agenda e no site. Use as setas para mudar a ordem em que os serviços aparecem no site."
      />
      {role !== "owner" ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Somente a proprietária pode alterar serviços.</p>
      ) : null}
      <ServicesManager
        services={(services.data ?? []) as Service[]}
        categories={(categories.data ?? []) as Category[]}
        professionals={(professionals.data ?? []) as Professional[]}
        combos={comboMap}
        openNew={novo === "1"}
      />
    </>
  );
}
