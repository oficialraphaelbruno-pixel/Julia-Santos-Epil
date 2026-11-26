/**
 * Lista de e-mails para campanhas: junta quem autorizou receber novidades no
 * agendamento (clientes) com quem se inscreveu pelo site/assistente.
 * Um e-mail aparece uma vez só, com todas as origens.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAnonymizedPhone } from "@/lib/phone";

export type EmailOrigin = "agendamento" | "site" | "faq" | "assistente";
export type EmailStatus = "atendida" | "agendada" | "nunca";

export const ORIGIN_LABEL: Record<EmailOrigin, string> = {
  agendamento: "Agendamento",
  site: "Página inicial",
  faq: "Página Dúvidas",
  assistente: "Assistente Mel",
};
export const STATUS_LABEL: Record<EmailStatus, string> = {
  atendida: "Já foi atendida",
  agendada: "Agendou, ainda não foi atendida",
  nunca: "Nunca agendou",
};

export interface EmailContact {
  email: string;
  name: string | null;
  clientId: string | null;
  subscriberId: string | null;
  origins: EmailOrigin[];
  status: EmailStatus;
  lastVisit: string | null;
  birthday: string | null;
  services: string[];
  since: string;
}

export interface EmailFilters {
  q?: string;
  origem?: string;
  situacao?: string;
  servico?: string;
  inativas?: string;
  aniversario?: string;
}

interface ClientRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  birthday: string | null;
  last_visit: string | null;
  completed_count: number;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  created_at: string;
}

export async function loadEmailContacts(db: SupabaseClient, businessId: string): Promise<EmailContact[]> {
  const [{ data: clients }, { data: subs }, { data: appts }] = await Promise.all([
    db
      .from("client_overview")
      .select("id, full_name, email, phone, birthday, last_visit, completed_count, marketing_consent, marketing_consent_at, created_at")
      .eq("business_id", businessId)
      .not("email", "is", null)
      .limit(20000),
    db.from("newsletter_subscribers").select("id, email, source, consent_at").eq("business_id", businessId).is("unsubscribed_at", null).limit(20000),
    db.from("appointments").select("client_id, service_name, status").eq("business_id", businessId).neq("status", "cancelled").limit(50000),
  ]);

  const byClient = new Map<string, { booked: boolean; services: Set<string> }>();
  for (const a of (appts ?? []) as { client_id: string; service_name: string; status: string }[]) {
    const e = byClient.get(a.client_id) ?? { booked: false, services: new Set<string>() };
    e.booked = true;
    if (a.status === "completed") for (const s of a.service_name.split(" + ")) e.services.add(s.trim());
    byClient.set(a.client_id, e);
  }

  const clientByEmail = new Map<string, ClientRow>();
  for (const c of (clients ?? []) as ClientRow[]) {
    if (!c.email || isAnonymizedPhone(c.phone)) continue;
    clientByEmail.set(c.email.trim().toLowerCase(), c);
  }

  const out = new Map<string, EmailContact>();
  const base = (email: string, c: ClientRow | undefined, since: string): EmailContact => {
    const info = c ? byClient.get(c.id) : undefined;
    return {
      email,
      name: c?.full_name ?? null,
      clientId: c?.id ?? null,
      subscriberId: null,
      origins: [],
      status: c && c.completed_count > 0 ? "atendida" : info?.booked ? "agendada" : "nunca",
      lastVisit: c?.last_visit ?? null,
      birthday: c?.birthday ?? null,
      services: info ? [...info.services].sort() : [],
      since,
    };
  };

  for (const [email, c] of clientByEmail) {
    if (!c.marketing_consent) continue;
    const row = base(email, c, c.marketing_consent_at ?? c.created_at);
    row.origins.push("agendamento");
    out.set(email, row);
  }
  for (const s of (subs ?? []) as { id: string; email: string; source: EmailOrigin; consent_at: string }[]) {
    const email = s.email.trim().toLowerCase();
    const row = out.get(email) ?? base(email, clientByEmail.get(email), s.consent_at);
    row.subscriberId = s.id;
    if (!row.origins.includes(s.source)) row.origins.push(s.source);
    if (s.consent_at > row.since) row.since = s.consent_at;
    out.set(email, row);
  }
  return [...out.values()].sort((a, b) => b.since.localeCompare(a.since));
}

export function filterContacts(rows: EmailContact[], f: EmailFilters, nowMs: number): EmailContact[] {
  const q = f.q?.trim().toLowerCase();
  const month = f.aniversario ? Number(f.aniversario) : null;
  return rows.filter((r) => {
    if (q && !r.email.includes(q) && !(r.name ?? "").toLowerCase().includes(q)) return false;
    if (f.origem && f.origem !== "todas" && !r.origins.includes(f.origem as EmailOrigin)) return false;
    if (f.situacao && f.situacao !== "todas" && r.status !== f.situacao) return false;
    if (f.servico && !r.services.includes(f.servico)) return false;
    if (f.inativas === "1" && (!r.lastVisit || nowMs - new Date(r.lastVisit).getTime() < 90 * 864e5)) return false;
    if (month && (!r.birthday || Number(r.birthday.slice(5, 7)) !== month)) return false;
    return true;
  });
}

/** CSV no formato aceito pela importação de contatos do Resend (separado por vírgula). */
export function contactsToResendCsv(rows: EmailContact[]) {
  const esc = (v: string) => {
    let s = v;
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [["email", "first_name", "last_name", "origem", "situacao"].join(",")];
  for (const r of rows) {
    const [first, ...rest] = (r.name ?? "").trim().split(/\s+/);
    lines.push(
      [r.email, first ?? "", rest.join(" "), r.origins.map((o) => ORIGIN_LABEL[o]).join(" / "), STATUS_LABEL[r.status]].map(esc).join(","),
    );
  }
  return lines.join("\n") + "\n";
}
