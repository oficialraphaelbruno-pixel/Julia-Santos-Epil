import type { Metadata } from "next";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Studio Manager" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  return (
    <div className="min-h-dvh bg-ivory lg:flex">
      <AdminSidebar logo={ctx.business.logo_url} businessName={ctx.business.name} email={ctx.email} />
      <div className="min-w-0 flex-1">
        <AdminMobileNav logo={ctx.business.logo_url} businessName={ctx.business.name} />
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}
