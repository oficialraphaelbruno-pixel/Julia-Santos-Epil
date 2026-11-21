import Link from "next/link";
import { Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { discountText } from "@/lib/coupon-code";
import { formatDate } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

export interface ClientReferralData {
  link: string | null;
  referredBy: { id: string; full_name: string } | null;
  made: { id: string; status: "pending" | "qualified" | "cancelled"; friend: { id: string; full_name: string } | null }[];
  rewards: { id: string; status: "available" | "used" | "cancelled"; discount_type: string; discount_value: number; expires_at: string | null }[];
}

const MADE_STATUS = { pending: "aguardando comparecer", qualified: "compareceu", cancelled: "cancelada" } as const;

export function ClientReferralCard({ data, phone, firstName, tz, expiredIds }: { data: ClientReferralData; phone: string; firstName: string; tz: string; expiredIds: string[] }) {
  const available = data.rewards.filter((r) => r.status === "available" && !expiredIds.includes(r.id));
  if (!data.link && !data.referredBy && data.made.length === 0 && data.rewards.length === 0) return null;
  return (
    <Card data-testid="cliente-indicacoes">
      <CardContent className="space-y-3 text-sm">
        <p className="flex items-center gap-2 font-display text-lg">
          <Gift className="size-4 text-gold" /> Indicações
        </p>
        {data.referredBy ? (
          <p data-testid="indicada-por">
            Indicada por{" "}
            <Link href={`/admin/clientes/${data.referredBy.id}`} className="font-medium text-gold-dark hover:underline">
              {data.referredBy.full_name}
            </Link>
          </p>
        ) : null}
        {available.length ? (
          <p className="rounded-xl bg-emerald-50 p-3 text-emerald-800" data-testid="desconto-disponivel">
            Desconto disponível: <b>{available.map((r) => discountText(r.discount_type, r.discount_value)).join(" + ")}</b>
            {available[0].expires_at ? ` (até ${formatDate(available[0].expires_at, tz)})` : ""}. É aplicado sozinho no próximo agendamento pelo site.
          </p>
        ) : null}
        {data.made.length ? (
          <div>
            <p className="mb-1 text-[13px] text-muted">Indicou {data.made.length} amiga(s):</p>
            <ul className="space-y-1" data-testid="indicacoes-feitas">
              {data.made.map((m) => (
                <li key={m.id}>
                  {m.friend ? (
                    <Link href={`/admin/clientes/${m.friend.id}`} className="hover:underline">
                      {m.friend.full_name}
                    </Link>
                  ) : (
                    "—"
                  )}{" "}
                  <span className="text-muted">· {MADE_STATUS[m.status]}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {data.link ? (
          <div className="rounded-xl bg-ivory p-3">
            <p className="mb-1 text-[13px] text-muted">Link pessoal de indicação</p>
            <p className="break-all font-medium text-ink" data-testid="cliente-link-indicacao">
              {data.link}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyButton value={data.link} size="sm" variant="outline" />
              <Button asChild size="sm" variant="outline">
                <a
                  href={whatsappLink(phone, `Oi, ${firstName}! Este é o seu link de indicação. Envie para suas amigas: quando uma amiga nova agendar por ele e for atendida, você ganha desconto no próximo atendimento 💛\n${data.link}`)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Enviar para a cliente
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
