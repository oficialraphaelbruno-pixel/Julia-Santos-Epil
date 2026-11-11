"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_THEME_COOKIE } from "@/lib/admin-theme";
const DARK = "admin-dark";

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}
const isDarkNow = () => document.documentElement.classList.contains(DARK);

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle(DARK, dark);
  document.getElementById("painel-root")?.classList.toggle(DARK, dark);
}

/**
 * Mantém o <html> com o tema do painel enquanto ele está aberto (diálogos e
 * avisos ficam fora do contêiner) e remove ao sair do painel, para o site
 * público continuar sempre claro.
 */
export function AdminThemeSync({ initialDark }: { initialDark: boolean }) {
  useEffect(() => {
    applyTheme(initialDark);
    return () => document.documentElement.classList.remove(DARK);
  }, [initialDark]);
  return null;
}

export function ThemeToggle({ initialDark, className, compact }: { initialDark: boolean; className?: string; compact?: boolean }) {
  const dark = useSyncExternalStore(subscribe, isDarkNow, () => initialDark);
  const toggle = () => {
    const next = !dark;
    applyTheme(next);
    document.cookie = `${ADMIN_THEME_COOKIE}=${next ? "escuro" : "claro"}; path=/; max-age=31536000; samesite=lax`;
  };
  const label = dark ? "Usar modo claro" : "Usar modo escuro";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      data-testid="theme-toggle"
      className={cn(
        "flex items-center gap-2 rounded-xl text-sm text-ink/70 transition hover:bg-ivory hover:text-ink",
        compact ? "p-2" : "w-full px-2 py-2",
        className,
      )}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {compact ? null : dark ? "Modo claro" : "Modo escuro"}
    </button>
  );
}
