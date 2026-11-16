import type { Metadata } from "next";
import Link from "next/link";
import { Ban, Cake, ChevronRight, Plus, Repeat, Search, UserX, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateKey, formatMoney, nowMs, todayKey } from "@/lib/format";
import { birthdayInMonth, daysUntilBirthday } from "@/lib/birthday";
import { signedClientPhotos } from "@/lib/client-photos";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clientes" };

interface Row {
  id: string;
  full_name: string;
  phone: string;
  last_visit: string | null;
  next_appointment: string | null;
  completed_count: number;
  total_spent_cents: number;
  created_at: string;
  birthday: string | null;
  photo_path: string | null;
  blocked_at: string | null;
}

const FILTERS = [
  { key: "", label: "Todas", icon: Users },
  { key: "recorrentes", label: "Recorrentes", icon: Repeat },
  { key: "inativas", label: "Inativas (90+ dias)", icon: UserX },
  { key: "aniversariantes", label: "Aniversariantes do mês", icon: Cake },
  { key: "bloqueadas", label: "Bloqueadas", icon: Ban },
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string }> }) {
  const { q = "", filtro = "" } = await searchParams;
  const { supabase, business } = await requireAdmin();
  const tz = business.timezone;

  let query = supabase
    .from("client_overview")
    .select("id, full_name, phone, last_visit, next_appointment, completed_count, total_spent_cents, created_at, birthday, photo_path, blocked_at")
    .eq("business_id", business.id)
    .not("phone", "like", "00%") // clientes com dados apagados (LGPD) não aparecem
    .order("full_name")
    .limit(300);

  const term = q.trim().slice(0, 60);
  if (term) {
    const digits = term.replace(/\D/g, "");
    query = digits.length >= 4 ? query.ilike("phone", `%${digits}%`) : query.ilike("full_name", `%${term.replace(/[%,()*]/g, " ")}%`);
  }
  if (filtro === "recorrentes") query = query.gte("completed_count", 2);
  if (filtro === "inativas") {
    query = query.lt("last_visit", new Date(nowMs() - 90 * 864e5).toISOString()).is("next_appointment", null);
  }
  if (filtro === "bloqueadas") query = query.not("blocked_at", "is", null);
  if (filtro === "aniversariantes") query = query.not("birthday", "is", null);
  const { data } = await query;
  const today = todayKey(tz);
  let rows = (data ?? []) as Row[];
  if (filtro === "aniversariantes") {
    rows = rows
      .filter((c) => c.birthday && birthdayInMonth(c.birthday, today))
      .sort((a, b) => a.birthday!.slice(5).localeCompare(b.birthday!.slice(5)));
  }
  const photos = await signedClientPhotos(supabase, rows.map((c) => c.photo_path));

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastro, histórico e relacionamento."
        actions={
          <Button asChild>
            <Link href="/admin/clientes/novo">
              <Plus /> Cadastrar cliente
            </Link>
          </Button>
        }
      />

      <form className="mb-4 flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={q} placeholder="Buscar por nome ou WhatsApp" className="pl-11" />
          {filtro ? <input type="hidden" name="filtro" value={filtro} /> : null}
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/clientes?${new URLSearchParams({ ...(q ? { q } : {}), ...(f.key ? { filtro: f.key } : {}) })}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition",
              filtro === f.key ? "border-gold bg-white text-gold-deep" : "border-line text-ink/60 hover:border-champagne",
            )}
          >
            <f.icon className="size-3.5" /> {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={term || filtro ? "Nenhuma cliente encontrada" : "Nenhuma cliente cadastrada"}
          description={term || filtro ? "Tente outro termo ou filtro." : "As clientes que agendarem online aparecem aqui automaticamente."}
        />
      ) : (
        <div className="card-premium divide-y divide-line/70 overflow-hidden">
          {rows.map((c) => (
            <Link key={c.id} href={`/admin/clientes/${c.id}`} className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-ivory/60 sm:px-6">
              {c.photo_path && photos.get(c.photo_path) ? (
                // eslint-disable-next-line @next/next/no-img-element -- link temporário do Storage
                <img src={photos.get(c.photo_path)} alt="" className="size-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream font-display text-gold-dark">
                  {c.full_name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-ink">
                  <span className="truncate">{c.full_name}</span>
                  {c.blocked_at ? (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700" data-testid="badge-bloqueada">
                      Bloqueada
                    </span>
                  ) : null}
                  {c.birthday && birthdayInMonth(c.birthday, today) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      <Cake className="size-3" />
                      {daysUntilBirthday(c.birthday, today) === 0 ? "Hoje!" : formatDateKey(c.birthday, "dd/MM")}
                    </span>
                  ) : null}
                </p>
                <p className="text-[13px] text-muted">{formatPhone(c.phone)}</p>
              </div>
              <div className="hidden text-right text-[13px] sm:block">
                <p className="text-ink/80">{c.completed_count} atend. · {formatMoney(c.total_spent_cents)}</p>
                <p className="text-muted">
                  {c.next_appointment
                    ? `Próximo: ${formatDate(c.next_appointment, tz)}`
                    : c.last_visit
                      ? `Última visita: ${formatDate(c.last_visit, tz)}`
                      : `Desde ${formatDate(c.created_at, tz)}`}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
