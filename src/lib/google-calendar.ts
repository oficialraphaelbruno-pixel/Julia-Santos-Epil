import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret, hasEncryptionKey } from "@/lib/crypto";
import { SITE_URL } from "@/lib/env";

/**
 * Integração oficial com o Google Agenda (OAuth 2.0 + Calendar API v3).
 * Escopos mínimos: eventos (criar/atualizar/remover e ler ocupação) e lista de agendas.
 */
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://www.googleapis.com/calendar/v3";
const OWN_EVENT_MARK = "studioManagerAppointmentId";

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${SITE_URL}/api/integracoes/google/callback`;
  const missing = [
    !clientId && "GOOGLE_CLIENT_ID",
    !clientSecret && "GOOGLE_CLIENT_SECRET",
    !hasEncryptionKey() && "INTEGRATIONS_ENCRYPTION_KEY",
  ].filter(Boolean) as string[];
  return { clientId, clientSecret, redirectUri, configured: missing.length === 0, missing };
}

export function buildAuthUrl(state: string) {
  const c = googleConfig();
  const params = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (!res.ok) throw new Error(`Google OAuth: ${json.error_description ?? json.error ?? res.status}`);
  return json;
}

export async function exchangeCode(code: string) {
  const c = googleConfig();
  const t = await tokenRequest({
    code,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    redirect_uri: c.redirectUri,
    grant_type: "authorization_code",
  });
  let email: string | null = null;
  if (t.id_token) {
    try {
      email = JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString()).email ?? null;
    } catch {
      email = null;
    }
  }
  return { accessToken: t.access_token, refreshToken: t.refresh_token as string | undefined, scope: t.scope, email };
}

export async function saveConnection(businessId: string, userId: string, data: { refreshToken: string; email: string | null; scope?: string }) {
  const db = createServiceClient();
  const { error } = await db.from("google_calendar_connections").upsert({
    business_id: businessId,
    refresh_token_encrypted: encryptSecret(data.refreshToken),
    google_email: data.email,
    scopes: data.scope ?? null,
    calendar_id: "primary",
    calendar_summary: data.email ? `Agenda principal (${data.email})` : "Agenda principal",
    status: "connected",
    last_error: null,
    connected_by: userId,
    connected_at: new Date().toISOString(),
  });
  if (error) throw new Error("Falha ao salvar a conexão.");
}

export interface GoogleConnection {
  business_id: string;
  google_email: string | null;
  calendar_id: string | null;
  calendar_summary: string | null;
  status: "connected" | "error";
  last_error: string | null;
  last_sync_at: string | null;
  connected_at: string;
}

export async function getConnection(businessId: string): Promise<(GoogleConnection & { refresh_token_encrypted: string }) | null> {
  const db = createServiceClient();
  const { data } = await db.from("google_calendar_connections").select("*").eq("business_id", businessId).maybeSingle();
  return data;
}

/** Status público (sem tokens) para o painel. */
export async function getConnectionStatus(businessId: string): Promise<GoogleConnection | null> {
  const c = await getConnection(businessId);
  if (!c) return null;
  const rest: GoogleConnection & { refresh_token_encrypted?: string } = { ...c };
  delete rest.refresh_token_encrypted;
  return rest;
}

async function accessTokenFor(businessId: string) {
  const conn = await getConnection(businessId);
  if (!conn) return null;
  const c = googleConfig();
  if (!c.configured) throw new Error("Credenciais do Google não configuradas no servidor.");
  const t = await tokenRequest({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: decryptSecret(conn.refresh_token_encrypted),
    grant_type: "refresh_token",
  });
  return { token: t.access_token, conn };
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Google Calendar ${res.status}: ${(json as { error?: { message?: string } }).error?.message ?? "erro"}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return json as T;
}

async function markError(businessId: string, message: string) {
  const db = createServiceClient();
  await db.from("google_calendar_connections").update({ status: "error", last_error: message.slice(0, 500) }).eq("business_id", businessId);
}

export async function listCalendars(businessId: string) {
  const a = await accessTokenFor(businessId);
  if (!a) return [];
  const data = await api<{ items: { id: string; summary: string; primary?: boolean; accessRole: string }[] }>(
    a.token,
    "/users/me/calendarList?minAccessRole=writer",
  );
  return (data.items ?? []).map((c) => ({ id: c.id, summary: c.summary, primary: Boolean(c.primary) }));
}

export async function selectCalendar(businessId: string, calendarId: string, summary: string) {
  const db = createServiceClient();
  await db.from("google_calendar_connections").update({ calendar_id: calendarId, calendar_summary: summary, status: "connected", last_error: null }).eq("business_id", businessId);
}

export async function disconnect(businessId: string) {
  const conn = await getConnection(businessId);
  if (!conn) return;
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(decryptSecret(conn.refresh_token_encrypted))}`, { method: "POST" });
  } catch {
    // mesmo se a revogação falhar, removemos as credenciais locais
  }
  const db = createServiceClient();
  await db.from("appointment_external_events").delete().eq("business_id", businessId);
  await db.from("google_calendar_connections").delete().eq("business_id", businessId);
}

export interface BusyResult {
  /** connected=false: integração não conectada (nada a verificar). */
  connected: boolean;
  /** ok=false: consulta falhou — horários externos NÃO foram verificados. */
  ok: boolean;
  intervals: { start: number; end: number }[];
}

/**
 * Períodos ocupados na agenda do Google (exceto eventos criados pelo próprio sistema
 * e eventos marcados como "disponível").
 */
export async function getBusyIntervals(businessId: string, timeMin: string, timeMax: string): Promise<BusyResult> {
  const conn = await getConnection(businessId);
  if (!conn || !conn.calendar_id) return { connected: false, ok: true, intervals: [] };
  try {
    const a = await accessTokenFor(businessId);
    if (!a) return { connected: false, ok: true, intervals: [] };
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", maxResults: "250", orderBy: "startTime" });
    const data = await api<{
      items: {
        status: string;
        transparency?: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
        extendedProperties?: { private?: Record<string, string> };
      }[];
    }>(a.token, `/calendars/${encodeURIComponent(conn.calendar_id)}/events?${params}`);
    const intervals = (data.items ?? [])
      .filter((e) => e.status !== "cancelled" && e.transparency !== "transparent" && !e.extendedProperties?.private?.[OWN_EVENT_MARK])
      .map((e) => ({
        start: Date.parse(e.start.dateTime ?? `${e.start.date}T00:00:00-03:00`),
        end: Date.parse(e.end.dateTime ?? `${e.end.date}T00:00:00-03:00`),
      }))
      .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end));
    return { connected: true, ok: true, intervals };
  } catch (e) {
    await markError(businessId, e instanceof Error ? e.message : "Falha ao consultar o Google Agenda");
    return { connected: true, ok: false, intervals: [] };
  }
}

export function overlapsBusy(intervals: BusyResult["intervals"], start: number, end: number) {
  return intervals.some((i) => i.start < end && i.end > start);
}

export interface EventInput {
  appointmentId: string;
  summary: string;
  description: string;
  location?: string | null;
  start: string;
  end: string;
  timeZone: string;
}

export async function upsertEvent(businessId: string, existingEventId: string | null, e: EventInput) {
  const a = await accessTokenFor(businessId);
  if (!a || !a.conn.calendar_id) throw new Error("Google Agenda não conectado.");
  const body = JSON.stringify({
    summary: e.summary,
    description: e.description,
    location: e.location ?? undefined,
    start: { dateTime: e.start, timeZone: e.timeZone },
    end: { dateTime: e.end, timeZone: e.timeZone },
    extendedProperties: { private: { [OWN_EVENT_MARK]: e.appointmentId } },
    reminders: { useDefault: true },
  });
  const cal = encodeURIComponent(a.conn.calendar_id);
  if (existingEventId) {
    try {
      const ev = await api<{ id: string }>(a.token, `/calendars/${cal}/events/${encodeURIComponent(existingEventId)}`, { method: "PATCH", body });
      return { id: ev.id, calendarId: a.conn.calendar_id };
    } catch (err) {
      if ((err as { status?: number }).status !== 404 && (err as { status?: number }).status !== 410) throw err;
    }
  }
  const ev = await api<{ id: string }>(a.token, `/calendars/${cal}/events`, { method: "POST", body });
  return { id: ev.id, calendarId: a.conn.calendar_id };
}

export async function deleteEvent(businessId: string, calendarId: string, eventId: string) {
  const a = await accessTokenFor(businessId);
  if (!a) return;
  try {
    await api(a.token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 404 && status !== 410) throw err;
  }
}
