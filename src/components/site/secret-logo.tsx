"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/site/brand-logo";

/**
 * Logomarca do cabeçalho. Um clique volta ao topo; três cliques rápidos
 * abrem /admin/login. É apenas um atalho visual: a segurança está no login.
 */
export function SecretLogo({ src, name, className }: { src: string | null; name: string; className?: string }) {
  const router = useRouter();
  const clicks = useRef<number[]>([]);

  return (
    <button
      type="button"
      aria-label={`${name} — voltar ao início`}
      className="cursor-pointer rounded-lg"
      onClick={() => {
        const now = Date.now();
        clicks.current = [...clicks.current.filter((t) => now - t < 900), now];
        if (clicks.current.length >= 3) {
          clicks.current = [];
          router.push("/admin/login");
          return;
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      <BrandLogo src={src} name={name} className={className} priority sizes="160px" />
    </button>
  );
}
