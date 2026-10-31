"use client";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { ClientForm } from "@/components/admin/client-form";

export default function NewClientPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="Cadastrar cliente" />
      <div className="card-premium max-w-xl p-6">
        <ClientForm onSaved={(c) => router.push(`/admin/clientes/${c.id}`)} onCancel={() => router.back()} />
      </div>
    </>
  );
}
