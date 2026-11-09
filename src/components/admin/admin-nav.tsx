"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  Clock,
  Globe,
  LayoutDashboard,
  LogOut,
  Landmark,
  Menu,
  TicketPercent,
  MessagesSquare,
  Plug,
  Plus,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/site/brand-logo";
import { logoutAction } from "@/app/admin/auth-actions";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/admin", label: "Painel de Controle", short: "Painel", icon: LayoutDashboard },
  { href: "/admin/agenda", label: "Agenda", short: "Agenda", icon: CalendarDays },
  { href: "/admin/clientes", label: "Clientes", short: "Clientes", icon: Users },
  { href: "/admin/servicos", label: "Serviços", short: "Serviços", icon: Sparkles },
  { href: "/admin/financeiro", label: "Financeiro", short: "Financeiro", icon: Landmark },
  { href: "/admin/cupons", label: "Cupons", short: "Cupons", icon: TicketPercent },
  { href: "/admin/horarios", label: "Horários e bloqueios", short: "Horários", icon: Clock },
  { href: "/admin/agendamento-online", label: "Agendamento Online", short: "Online", icon: Globe },
  { href: "/admin/comunicacao", label: "Comunicação", short: "Mensagens", icon: MessagesSquare },
  { href: "/admin/integracoes", label: "Integrações", short: "Integrações", icon: Plug },
  { href: "/admin/configuracoes", label: "Configurações", short: "Config.", icon: Settings },
];

function isActive(path: string, href: string) {
  return href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/");
}

export function AdminSidebar({ logo, businessName, email }: { logo: string | null; businessName: string; email: string }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 flex-col border-r border-line/80 bg-white lg:flex">
      <div className="px-6 pb-4 pt-7">
        <Link href="/admin" aria-label="Painel">
          <BrandLogo src={logo} name={businessName} className="h-16 w-[100px]" priority />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Painel administrativo">
        {NAV_ITEMS.map((item) => {
          const active = isActive(path, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] transition",
                active ? "bg-ivory font-medium text-gold-deep shadow-[inset_2px_0_0_#b68d40]" : "text-ink/70 hover:bg-ivory/70 hover:text-ink",
              )}
            >
              <item.icon className={cn("size-[18px]", active ? "text-gold" : "text-ink/40 group-hover:text-gold")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line/70 p-4">
        <p className="truncate px-2 text-xs text-muted" title={email}>
          {email}
        </p>
        <form action={logoutAction}>
          <button type="submit" className="mt-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm text-ink/70 transition hover:bg-ivory hover:text-ink">
            <LogOut className="size-4" /> Sair
          </button>
        </form>
      </div>
    </aside>
  );
}

export function AdminMobileNav({ logo, businessName }: { logo: string | null; businessName: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const bottom = [NAV_ITEMS[0], NAV_ITEMS[1], null, NAV_ITEMS[2]];

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line/70 bg-white/90 px-4 backdrop-blur lg:hidden">
        <Link href="/admin" aria-label="Painel">
          <BrandLogo src={logo} name={businessName} className="h-11 w-[70px]" priority />
        </Link>
        <span className="font-display text-[15px] text-ink/80">Studio Manager</span>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Navegação"
      >
        {bottom.map((item, i) =>
          item ? (
            <Link
              key={item.href}
              href={item.href}
              className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", isActive(path, item.href) ? "text-gold-dark" : "text-ink/50")}
            >
              <item.icon className="size-5" />
              {item.short}
            </Link>
          ) : (
            <Link key={`new-${i}`} href="/admin/agenda/novo" className="flex items-center justify-center" aria-label="Novo agendamento">
              <span className="-mt-6 grid size-14 place-items-center rounded-full bg-[linear-gradient(135deg,#c9a35f,#92702e)] text-white shadow-lift">
                <Plus className="size-6" />
              </span>
            </Link>
          ),
        )}
        <button type="button" onClick={() => setOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-ink/50">
          <Menu className="size-5" /> Mais
        </button>
      </nav>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-ink/40" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 animate-fade-up rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg">Menu</p>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-ivory" aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-[12px]",
                    isActive(path, item.href) ? "border-champagne bg-ivory text-gold-deep" : "border-line text-ink/70",
                  )}
                >
                  <item.icon className="size-5 text-gold" />
                  {item.short}
                </Link>
              ))}
              <form action={logoutAction} className="contents">
                <button type="submit" className="flex flex-col items-center gap-2 rounded-2xl border border-line p-3 text-[12px] text-ink/70">
                  <LogOut className="size-5 text-gold" /> Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
