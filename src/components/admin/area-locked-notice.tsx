import { Lock } from "lucide-react";

/** Aviso exibido quando o administrador geral bloqueou a edição de uma área. */
export function AreaLockedNotice({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <p className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="area-bloqueada">
      <Lock className="mt-0.5 size-4 shrink-0" />
      <span>
        Edição bloqueada pelo administrador do painel: <b className="font-medium">{labels.join(", ")}</b>. Você pode consultar, mas não alterar.
      </span>
    </p>
  );
}
