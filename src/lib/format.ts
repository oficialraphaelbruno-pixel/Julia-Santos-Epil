import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const DEFAULT_TZ = "America/Sao_Paulo";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** R$ 1.234,56 */
export function formatMoney(cents: number | null | undefined): string {
  return brl.format((cents ?? 0) / 100).replace(/ /g, " ");
}

/** Converte "120,50" / "120.50" / "R$ 1.200,50" em centavos. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = (input ?? "").replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function centsToInput(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2).replace(".", ",");
}

export function inTz(date: Date | string, tz = DEFAULT_TZ) {
  return new TZDate(typeof date === "string" ? new Date(date) : date, tz);
}

/** DD/MM/AAAA */
export function formatDate(date: Date | string, tz = DEFAULT_TZ) {
  return format(inTz(date, tz), "dd/MM/yyyy", { locale: ptBR });
}

/** HH:mm (24h) */
export function formatTime(date: Date | string, tz = DEFAULT_TZ) {
  return format(inTz(date, tz), "HH:mm", { locale: ptBR });
}

/** "sábado, 07 de novembro" */
export function formatLongDate(date: Date | string, tz = DEFAULT_TZ) {
  return format(inTz(date, tz), "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function formatDateTime(date: Date | string, tz = DEFAULT_TZ) {
  return `${formatDate(date, tz)} às ${formatTime(date, tz)}`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Data local (YYYY-MM-DD) de um instante no fuso informado. */
export function toLocalDateKey(date: Date | string, tz = DEFAULT_TZ) {
  return format(inTz(date, tz), "yyyy-MM-dd");
}

/** Hoje (YYYY-MM-DD) no fuso da empresa. */
export function todayKey(tz = DEFAULT_TZ) {
  return toLocalDateKey(new Date(), tz);
}

/** Converte data (YYYY-MM-DD) + hora (HH:mm) locais do fuso em instante UTC (ISO). */
export function localToUtcIso(dateKey: string, time: string, tz = DEFAULT_TZ): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, tz).getTime()).toISOString();
}

/** Soma dias a uma chave de data (YYYY-MM-DD), sem depender do fuso do servidor. */
export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function weekdayOfKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatDateKey(dateKey: string, pattern = "dd/MM/yyyy") {
  const [y, m, d] = dateKey.split("-").map(Number);
  return format(new Date(y, m - 1, d, 12), pattern, { locale: ptBR });
}

export const WEEKDAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** Instante atual em milissegundos (uso em Server Components). */
export function nowMs() {
  return Date.now();
}
