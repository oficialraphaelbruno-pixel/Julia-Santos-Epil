import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-nav";
import { AdminThemeSync } from "@/components/admin/theme-toggle";
import { ADMIN_THEME_COOKIE } from "@/lib/admin-theme";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Studio Manager" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  const dark = (await cookies()).get(ADMIN_THEME_COOKIE)?.value === "escuro";
  return (
    <div id="painel-root" className={`min-h-dvh bg-ivory text-ink lg:flex${dark ? " admin-dark" : ""}`}>
      <AdminThemeSync initialDark={dark} />
      <AdminSidebar logo={ctx.business.logo_url} businessName={ctx.business.name} email={ctx.email} dark={dark} />
      <div className="min-w-0 flex-1">
        <AdminMobileNav logo={ctx.business.logo_url} businessName={ctx.business.name} dark={dark} />
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}
