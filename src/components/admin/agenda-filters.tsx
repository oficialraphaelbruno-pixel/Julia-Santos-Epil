"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";
import { STATUS_LABEL, type AppointmentStatus } from "@/lib/constants";

export function AgendaFilters({ services, professionals }: { services: { id: string; name: string }[]; professionals: { id: string; display_name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const set = (key: string, value: string) => {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`/admin/agenda?${p.toString()}`);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Select aria-label="Filtrar por serviço" className="h-9 w-auto min-w-40 text-sm" value={sp.get("servico") ?? ""} onChange={(e) => set("servico", e.target.value)}>
        <option value="">Todos os serviços</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      {professionals.length > 1 ? (
        <Select aria-label="Filtrar por profissional" className="h-9 w-auto min-w-40 text-sm" value={sp.get("profissional") ?? ""} onChange={(e) => set("profissional", e.target.value)}>
          <option value="">Todas as profissionais</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </Select>
      ) : null}
      <Select aria-label="Filtrar por situação" className="h-9 w-auto min-w-40 text-sm" value={sp.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
        <option value="">Ativos (sem cancelados)</option>
        <option value="todos">Todas as situações</option>
        {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </Select>
    </div>
  );
}
