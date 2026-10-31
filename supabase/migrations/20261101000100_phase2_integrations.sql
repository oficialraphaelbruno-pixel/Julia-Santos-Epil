-- =====================================================================
-- Fase 2: integrações (Google Agenda), comunicação (e-mail, lembretes,
-- WhatsApp oficial opcional) e registros de sincronização/envio.
-- Credenciais de integração NÃO são acessíveis por usuárias logadas:
-- apenas o servidor (service role) lê/grava essas tabelas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Google Agenda
-- ---------------------------------------------------------------------
create table public.google_calendar_connections (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  google_email text,
  calendar_id text,
  calendar_summary text,
  refresh_token_encrypted text not null,  -- AES-256-GCM (chave só no servidor)
  scopes text,
  status text not null default 'connected' check (status in ('connected', 'error')),
  last_error text,
  last_sync_at timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger google_connections_updated_at before update on public.google_calendar_connections
  for each row execute function public.set_updated_at();

-- Vínculo agendamento interno ↔ evento externo
create table public.appointment_external_events (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  provider text not null default 'google',
  calendar_id text not null,
  external_event_id text not null,
  synced_at timestamptz not null default now(),
  unique (provider, calendar_id, external_event_id)
);

-- Registro de sincronizações (sucesso e falhas)
create table public.sync_logs (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  provider text not null default 'google',
  action text not null,
  ok boolean not null,
  message text,
  created_at timestamptz not null default now()
);
create index sync_logs_business_idx on public.sync_logs (business_id, created_at desc);

-- ---------------------------------------------------------------------
-- Comunicação
-- ---------------------------------------------------------------------
create table public.notification_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  email_enabled boolean not null default true,
  email_reply_to text,
  email_on_booking boolean not null default true,
  email_on_confirm boolean not null default true,
  email_on_cancel boolean not null default true,
  email_on_reschedule boolean not null default true,
  email_reminder_day_before boolean not null default true,
  email_reminder_2h boolean not null default false,
  whatsapp_api_enabled boolean not null default false,
  whatsapp_api_tested_at timestamptz,
  -- Modelos de mensagem editáveis (WhatsApp manual e e-mail). Variáveis: {nome} {servico} {data} {horario} {empresa} {link}
  templates jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger notification_settings_updated_at before update on public.notification_settings
  for each row execute function public.set_updated_at();

insert into public.notification_settings (business_id) select id from public.businesses on conflict do nothing;

create or replace function public.handle_new_business_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_settings (business_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_business_created_notifications after insert on public.businesses
  for each row execute function public.handle_new_business_notifications();

-- Histórico de mensagens automáticas (somente envios reais ficam como 'sent').
create table public.message_logs (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp_api')),
  template text not null,
  dedupe_key text,                 -- evita lembretes duplicados
  recipient text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);
create unique index message_logs_dedupe_idx on public.message_logs (dedupe_key) where dedupe_key is not null and status = 'sent';
create index message_logs_business_idx on public.message_logs (business_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.google_calendar_connections enable row level security;
alter table public.appointment_external_events enable row level security;
alter table public.sync_logs enable row level security;
alter table public.notification_settings enable row level security;
alter table public.message_logs enable row level security;

-- Tokens do Google: nenhum acesso para usuárias (somente servidor).
revoke all on public.google_calendar_connections from anon, authenticated;

revoke all on public.appointment_external_events, public.sync_logs, public.notification_settings, public.message_logs from anon;
revoke insert, update, delete on public.appointment_external_events, public.sync_logs, public.message_logs from authenticated;

create policy "membros leem vinculos externos" on public.appointment_external_events
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria le sincronizacoes" on public.sync_logs
  for select to authenticated using (public.is_owner(business_id));
create policy "membros leem mensagens" on public.message_logs
  for select to authenticated using (public.is_member(business_id));
create policy "membros leem comunicacao" on public.notification_settings
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria altera comunicacao" on public.notification_settings
  for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));

-- O WhatsApp automático só pode ser ligado depois de um envio de teste real.
create or replace function public.guard_whatsapp_api_toggle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.whatsapp_api_enabled and not old.whatsapp_api_enabled and new.whatsapp_api_tested_at is null then
    raise exception 'WHATSAPP_NAO_TESTADO' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger notification_settings_guard_whatsapp before update on public.notification_settings
  for each row execute function public.guard_whatsapp_api_toggle();

-- Histórico de um agendamento para o painel (auditoria filtrada).
create or replace function public.appointment_history(p_appointment_id uuid)
returns table (created_at timestamptz, action text, actor text, details jsonb)
language sql stable security definer set search_path = '' as $$
  select l.created_at, l.action,
         coalesce(l.actor_label, 'Painel'),
         l.details
    from public.audit_logs l
    join public.appointments a on a.id = l.entity_id
   where l.entity = 'appointments' and l.entity_id = p_appointment_id
     and public.is_member(a.business_id)
   order by l.created_at;
$$;
revoke execute on function public.appointment_history(uuid) from public, anon;
grant execute on function public.appointment_history(uuid) to authenticated;
