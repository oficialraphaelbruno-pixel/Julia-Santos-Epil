-- =====================================================================
-- Julia Santos Epil | Studio Manager — Esquema principal (Fase 1)
-- Arquitetura multiempresa (multi-tenant): toda tabela de negócio possui
-- business_id e é protegida por Row Level Security.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.plan_code as enum ('gratuito', 'essencial', 'profissional', 'premium');
create type public.member_role as enum ('owner', 'staff');
create type public.service_status as enum ('active', 'inactive', 'archived');
create type public.appointment_status as enum (
  'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
);
create type public.appointment_source as enum ('admin', 'online');
create type public.block_kind as enum ('bloqueio', 'ferias', 'feriado', 'pessoal');
create type public.payment_method as enum ('pix', 'dinheiro', 'cartao_credito', 'cartao_debito', 'outros');
create type public.payment_kind as enum ('pagamento', 'estorno');

-- ---------------------------------------------------------------------
-- Utilitário: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Empresas (tenants)
-- ---------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  name text not null check (length(name) between 2 and 120),
  timezone text not null default 'America/Sao_Paulo',
  currency text not null default 'BRL',
  plan public.plan_code not null default 'gratuito',
  billing_exempt boolean not null default false,
  -- Contato
  whatsapp_phone text check (whatsapp_phone ~ '^[0-9]{10,15}$'),
  instagram_url text,
  email text,
  -- Endereço (exibido somente quando preenchido)
  address_line text,
  address_district text,
  address_city text,
  address_state text,
  address_zip text,
  maps_url text,
  -- Informações comerciais
  legal_name text,
  document_id text,
  business_hours_note text,
  -- Conteúdo do site
  hero_title text,
  hero_subtitle text,
  about_title text,
  about_text text,
  philosophy_text text,
  logo_url text,
  photo_url text,
  cover_url text,
  privacy_policy text,
  terms_of_use text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

create table public.booking_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  online_enabled boolean not null default true,
  intro_text text,
  auto_confirm boolean not null default false,
  min_advance_minutes integer not null default 120 check (min_advance_minutes between 0 and 20160),
  max_advance_days integer not null default 60 check (max_advance_days between 1 and 365),
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes in (5, 10, 15, 20, 30, 45, 60)),
  allow_client_cancel boolean not null default true,
  cancel_min_hours integer not null default 24 check (cancel_min_hours between 0 and 720),
  allow_client_reschedule boolean not null default true,
  reschedule_min_hours integer not null default 24 check (reschedule_min_hours between 0 and 720),
  cancellation_policy text,
  max_active_bookings_per_client integer not null default 3 check (max_active_bookings_per_client between 1 and 20),
  updated_at timestamptz not null default now()
);
create trigger booking_settings_updated_at before update on public.booking_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Usuários e permissões
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

-- Funções auxiliares de autorização (usadas pelas políticas RLS).
create or replace function public.is_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_owner(p_business_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

-- ---------------------------------------------------------------------
-- Profissionais e horários
-- ---------------------------------------------------------------------
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (length(display_name) between 2 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);
create index professionals_business_idx on public.professionals (business_id);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  professional_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  is_open boolean not null default false,
  open_time time,
  close_time time,
  break_start time,
  break_end time,
  unique (professional_id, weekday),
  foreign key (business_id, professional_id) references public.professionals (business_id, id) on delete cascade,
  check (not is_open or (open_time is not null and close_time is not null and close_time > open_time)),
  check ((break_start is null) = (break_end is null)),
  check (break_start is null or (break_end > break_start and (not is_open or (break_start >= open_time and break_end <= close_time))))
);

create table public.special_days (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  professional_id uuid not null,
  day date not null,
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  break_start time,
  break_end time,
  note text,
  created_at timestamptz not null default now(),
  unique (professional_id, day),
  foreign key (business_id, professional_id) references public.professionals (business_id, id) on delete cascade,
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time)),
  check ((break_start is null) = (break_end is null)),
  check (break_start is null or break_end > break_start)
);

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  professional_id uuid, -- nulo = todo o studio
  kind public.block_kind not null default 'bloqueio',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (business_id, professional_id) references public.professionals (business_id, id) on delete cascade
);
create index time_blocks_range_idx on public.time_blocks using gist (business_id, tstzrange(starts_at, ends_at));

-- ---------------------------------------------------------------------
-- Serviços
-- ---------------------------------------------------------------------
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(name) between 2 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, name),
  unique (business_id, id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid,
  professional_id uuid,
  name text not null check (length(name) between 2 and 120),
  description text,
  price_cents integer not null check (price_cents between 0 and 100000000),
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  prep_minutes integer not null default 0 check (prep_minutes between 0 and 240),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 240),
  image_url text,
  status public.service_status not null default 'active',
  show_online boolean not null default true,
  is_combo boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, category_id) references public.service_categories (business_id, id) on delete set null (category_id),
  foreign key (business_id, professional_id) references public.professionals (business_id, id) on delete set null (professional_id)
);
create index services_business_idx on public.services (business_id, status);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

create table public.service_combo_items (
  business_id uuid not null references public.businesses (id) on delete cascade,
  combo_id uuid not null,
  service_id uuid not null,
  primary key (combo_id, service_id),
  foreign key (business_id, combo_id) references public.services (business_id, id) on delete cascade,
  foreign key (business_id, service_id) references public.services (business_id, id) on delete cascade,
  check (combo_id <> service_id)
);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  full_name text not null check (length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^[0-9]{10,15}$'), -- E.164 sem "+", ex.: 5531998628886
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  birthday date,
  notes text,
  privacy_accepted_at timestamptz,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  source public.appointment_source not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, phone),
  unique (business_id, id)
);
create index clients_name_idx on public.clients (business_id, lower(full_name));
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Agendamentos
-- ---------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  professional_id uuid not null,
  service_id uuid,
  client_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  prep_minutes integer not null default 0,
  buffer_after_minutes integer not null default 0,
  -- Intervalo realmente ocupado (preparação + atendimento + intervalo após)
  occupied tstzrange not null, -- calculado pelo gatilho appointments_set_occupied
  status public.appointment_status not null default 'pending',
  source public.appointment_source not null default 'admin',
  reference_code text not null unique,
  manage_token_hash text unique,
  service_name text not null,
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null,
  notes text,          -- observação interna (somente equipe)
  client_message text, -- observação enviada pela cliente
  confirmed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('cliente', 'studio')),
  cancel_reason text,
  reschedule_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (business_id, professional_id) references public.professionals (business_id, id),
  foreign key (business_id, service_id) references public.services (business_id, id) on delete set null (service_id),
  foreign key (business_id, client_id) references public.clients (business_id, id),
  -- Proteção definitiva contra choque de horários do mesmo profissional.
  -- Cancelados e faltas não bloqueiam a agenda.
  constraint appointments_no_overlap exclude using gist (
    professional_id with =, occupied with &&
  ) where (status not in ('cancelled', 'no_show'))
);
create index appointments_business_start_idx on public.appointments (business_id, starts_at);
create index appointments_client_idx on public.appointments (client_id, starts_at);
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

create or replace function public.appointments_set_occupied()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.occupied := tstzrange(
    new.starts_at - make_interval(mins => new.prep_minutes),
    new.ends_at + make_interval(mins => new.buffer_after_minutes),
    '[)'
  );
  return new;
end;
$$;
create trigger appointments_occupied before insert or update of starts_at, ends_at, prep_minutes, buffer_after_minutes
  on public.appointments for each row execute function public.appointments_set_occupied();

-- ---------------------------------------------------------------------
-- Pagamentos (registro manual — base para o Financeiro da Fase 3)
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  client_id uuid,
  kind public.payment_kind not null default 'pagamento',
  method public.payment_method not null,
  amount_cents integer not null check (amount_cents > 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  paid_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (business_id, client_id) references public.clients (business_id, id) on delete set null (client_id)
);
create index payments_business_paid_idx on public.payments (business_id, paid_at);

-- ---------------------------------------------------------------------
-- Auditoria e limitação de abuso
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  business_id uuid references public.businesses (id) on delete cascade,
  actor_id uuid,
  actor_label text,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_business_idx on public.audit_logs (business_id, created_at desc);

create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);
