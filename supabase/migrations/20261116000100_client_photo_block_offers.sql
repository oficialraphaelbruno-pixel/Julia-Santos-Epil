-- =====================================================================
-- Fotos de clientes, bloqueio de clientes e ofertas (order bump)
-- Publicação sem interrupção: funções novas ao lado das atuais (*_v2/_v3);
-- as funções substituídas mantêm a mesma assinatura.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clientes: foto (arquivo privado) e bloqueio
-- ---------------------------------------------------------------------
alter table public.clients
  add column photo_path text,
  add column blocked_at timestamptz,
  add column blocked_reason text check (blocked_reason is null or length(blocked_reason) <= 500);

-- A visão usa c.*: recriada para incluir as colunas novas.
drop view if exists public.client_overview;
create view public.client_overview with (security_invoker = true) as
select
  c.*,
  (select max(a.starts_at) from public.appointments a
    where a.client_id = c.id and a.status = 'completed') as last_visit,
  (select min(a.starts_at) from public.appointments a
    where a.client_id = c.id and a.status in ('pending', 'confirmed') and a.starts_at > now()) as next_appointment,
  (select count(*) from public.appointments a
    where a.client_id = c.id and a.status = 'completed')::int as completed_count,
  (select coalesce(sum(a.price_cents), 0) from public.appointments a
    where a.client_id = c.id and a.status = 'completed')::int as total_spent_cents
from public.clients c;
revoke all on public.client_overview from anon;
grant select on public.client_overview to authenticated;

-- Fotos: bucket PRIVADO (acesso só por link temporário), pasta = id da empresa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-photos', 'client-photos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
create policy "membros enviam fotos de clientes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "membros veem fotos de clientes" on storage.objects
  for select to authenticated
  using (bucket_id = 'client-photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "membros removem fotos de clientes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-photos' and public.is_member(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------
-- Ofertas (order bump): serviço extra com preço especial para quem
-- agenda o serviço principal.
-- ---------------------------------------------------------------------
create table public.service_offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid not null,
  offer_service_id uuid not null,
  offer_price_cents integer not null check (offer_price_cents >= 0),
  headline text check (headline is null or length(headline) <= 120),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, service_id) references public.services (business_id, id) on delete cascade,
  foreign key (business_id, offer_service_id) references public.services (business_id, id) on delete cascade,
  unique (service_id, offer_service_id),
  check (service_id <> offer_service_id)
);
create index service_offers_service_idx on public.service_offers (service_id, sort_order);
create trigger service_offers_updated_at before update on public.service_offers
  for each row execute function public.set_updated_at();
create trigger audit_service_offers after insert or update or delete on public.service_offers
  for each row execute function public.audit_row_change();

alter table public.service_offers enable row level security;
revoke all on public.service_offers from anon;
create policy "membros leem ofertas" on public.service_offers
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria insere ofertas" on public.service_offers
  for insert to authenticated with check (public.is_owner(business_id));
create policy "proprietaria altera ofertas" on public.service_offers
  for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));
create policy "proprietaria remove ofertas" on public.service_offers
  for delete to authenticated using (public.is_owner(business_id));

-- Serviços extras de um agendamento: [{service_id, name, price_cents, original_price_cents, duration_minutes}]
alter table public.appointments add column extras jsonb;

-- ---------------------------------------------------------------------
-- Horários livres considerando minutos extras (serviços adicionados).
-- ---------------------------------------------------------------------
create or replace function public.get_available_slots_v2(
  p_business_id uuid,
  p_service_id uuid,
  p_day date,
  p_extra_minutes integer default 0,
  p_exclude_appointment_id uuid default null,
  p_online boolean default true
) returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_service public.services%rowtype;
  v_settings public.booking_settings%rowtype;
  v_prof uuid;
  v_open time; v_close time; v_is_open boolean;
  v_special public.special_days%rowtype;
  v_cursor timestamptz; v_day_end timestamptz;
  v_step interval; v_dur interval;
  v_min_start timestamptz;
  v_today date;
begin
  if coalesce(auth.role(), '') = 'authenticated' and not public.is_member(p_business_id) then return; end if;

  select b.timezone into v_tz from public.businesses b where b.id = p_business_id;
  if v_tz is null then return; end if;

  select * into v_service from public.services s
   where s.id = p_service_id and s.business_id = p_business_id and s.status = 'active';
  if not found then return; end if;
  if p_online and not v_service.show_online then return; end if;

  v_prof := public.service_professional(p_business_id, p_service_id);
  if v_prof is null then return; end if;

  select * into v_settings from public.booking_settings bs where bs.business_id = p_business_id;
  v_step := make_interval(mins => coalesce(v_settings.slot_interval_minutes, 30));
  v_dur := make_interval(mins => v_service.duration_minutes + greatest(coalesce(p_extra_minutes, 0), 0));
  v_today := (now() at time zone v_tz)::date;

  if p_online then
    if p_day < v_today or p_day > v_today + coalesce(v_settings.max_advance_days, 60) then return; end if;
    v_min_start := now() + make_interval(mins => coalesce(v_settings.min_advance_minutes, 0));
  else
    v_min_start := '-infinity';
  end if;

  select * into v_special from public.special_days sd where sd.professional_id = v_prof and sd.day = p_day;
  if found then
    if v_special.is_closed then return; end if;
    v_open := v_special.open_time; v_close := v_special.close_time;
  else
    select w.is_open, w.open_time, w.close_time into v_is_open, v_open, v_close
      from public.working_hours w where w.professional_id = v_prof and w.weekday = extract(dow from p_day)::int;
    if not coalesce(v_is_open, false) then return; end if;
  end if;

  v_cursor := (p_day + v_open) at time zone v_tz;
  v_day_end := (p_day + v_close) at time zone v_tz;

  while v_cursor + v_dur <= v_day_end loop
    if v_cursor >= v_min_start and public.check_slot(
         p_business_id, v_prof, v_cursor, v_cursor + v_dur,
         v_service.prep_minutes, v_service.buffer_after_minutes,
         p_exclude_appointment_id, true) is null then
      slot_start := v_cursor;
      slot_end := v_cursor + v_dur;
      return next;
    end if;
    v_cursor := v_cursor + v_step;
  end loop;
end;
$$;

create or replace function public.get_available_days_v2(
  p_business_id uuid,
  p_service_id uuid,
  p_from date,
  p_to date,
  p_extra_minutes integer default 0,
  p_exclude_appointment_id uuid default null
) returns setof date
language plpgsql stable security definer set search_path = '' as $$
declare d date;
begin
  if p_to - p_from > 62 then p_to := p_from + 62; end if;
  for d in select generate_series(p_from, p_to, interval '1 day')::date loop
    if exists (select 1 from public.get_available_slots_v2(p_business_id, p_service_id, d, p_extra_minutes, p_exclude_appointment_id, true)) then
      return next d;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Agendamento online v3: ofertas (order bump) + bloqueio de clientes.
-- ---------------------------------------------------------------------
create or replace function public.create_online_booking_v3(
  p_business_id uuid, p_service_id uuid, p_starts_at timestamptz, p_full_name text, p_phone text,
  p_email text, p_marketing_consent boolean, p_client_message text, p_manage_token_hash text,
  p_coupon_code text default null,
  p_offer_ids uuid[] default null
) returns table (appointment_id uuid, reference_code text, status public.appointment_status)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_settings public.booking_settings%rowtype;
  v_service public.services%rowtype;
  v_tz text; v_prof uuid; v_client_id uuid; v_active integer;
  v_status public.appointment_status; v_ref text; v_id uuid;
  v_coupon record;
  v_price integer;
  v_offer_ids uuid[];
  v_found integer := 0;
  v_extra_min integer := 0;
  v_extra_price integer := 0;
  v_extra_list integer := 0;
  v_extra_names text;
  v_extras jsonb;
  v_duration integer;
begin
  select * into v_settings from public.booking_settings bs where bs.business_id = p_business_id;
  if not found or not v_settings.online_enabled then
    raise exception 'AGENDAMENTO_DESATIVADO' using errcode = 'P0001';
  end if;

  -- Cliente bloqueada pelo studio (por WhatsApp ou e-mail): não agenda online.
  if exists (
    select 1 from public.clients c
     where c.business_id = p_business_id and c.blocked_at is not null
       and (c.phone = p_phone or (nullif(trim(coalesce(p_email, '')), '') is not null and lower(c.email) = lower(trim(p_email))))
  ) then
    raise exception 'CLIENTE_BLOQUEADO' using errcode = 'P0001';
  end if;

  select b.timezone into v_tz from public.businesses b where b.id = p_business_id;
  select * into v_service from public.services s
   where s.id = p_service_id and s.business_id = p_business_id and s.status = 'active' and s.show_online;
  if not found then raise exception 'SERVICO_INDISPONIVEL' using errcode = 'P0001'; end if;
  v_prof := public.service_professional(p_business_id, p_service_id);
  if v_prof is null then raise exception 'SERVICO_INDISPONIVEL' using errcode = 'P0001'; end if;

  -- Ofertas escolhidas: precisam ser do serviço principal, ativas e com serviço ativo.
  select array_agg(distinct x) into v_offer_ids from unnest(coalesce(p_offer_ids, '{}'::uuid[])) x;
  if v_offer_ids is not null and cardinality(v_offer_ids) > 0 then
    select count(*), coalesce(sum(s.duration_minutes), 0), coalesce(sum(o.offer_price_cents), 0),
           coalesce(sum(s.price_cents), 0),
           string_agg(s.name, ' + ' order by o.sort_order, s.name),
           jsonb_agg(jsonb_build_object(
             'offer_id', o.id, 'service_id', s.id, 'name', s.name,
             'price_cents', o.offer_price_cents, 'original_price_cents', s.price_cents,
             'duration_minutes', s.duration_minutes) order by o.sort_order, s.name)
      into v_found, v_extra_min, v_extra_price, v_extra_list, v_extra_names, v_extras
      from public.service_offers o
      join public.services s on s.id = o.offer_service_id and s.business_id = o.business_id
     where o.business_id = p_business_id and o.service_id = p_service_id and o.active
       and s.status = 'active' and o.id = any (v_offer_ids);
    if v_found <> cardinality(v_offer_ids) then
      raise exception 'OFERTA_INDISPONIVEL' using errcode = 'P0001';
    end if;
  end if;
  v_duration := v_service.duration_minutes + v_extra_min;

  perform pg_advisory_xact_lock(hashtextextended('agenda:' || v_prof::text, 0));
  if not exists (
    select 1 from public.get_available_slots_v2(p_business_id, p_service_id, (p_starts_at at time zone v_tz)::date, v_extra_min, null, true) gs
     where gs.slot_start = p_starts_at
  ) then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = 'P0001';
  end if;

  v_price := v_service.price_cents;
  select null::uuid as coupon_id, null::text as code, 0 as discount_cents into v_coupon;
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select * into v_coupon from public.coupon_check(p_business_id, p_coupon_code, p_service_id, p_phone, true);
    if v_coupon.error is not null then
      raise exception '%', v_coupon.error using errcode = 'P0001';
    end if;
    v_price := v_coupon.final_cents;
  end if;

  insert into public.clients (business_id, full_name, phone, email, privacy_accepted_at, marketing_consent, marketing_consent_at, source)
  values (p_business_id, p_full_name, p_phone, nullif(p_email, ''), now(), coalesce(p_marketing_consent, false),
          case when p_marketing_consent then now() end, 'online')
  on conflict (business_id, phone) do update
     set email = coalesce(public.clients.email, excluded.email),
         privacy_accepted_at = now(),
         marketing_consent = public.clients.marketing_consent or excluded.marketing_consent,
         marketing_consent_at = case when excluded.marketing_consent and not public.clients.marketing_consent
                                     then now() else public.clients.marketing_consent_at end
  returning id into v_client_id;
  select count(*) into v_active from public.appointments a
   where a.client_id = v_client_id and a.starts_at > now() and a.status in ('pending', 'confirmed');
  if v_active >= v_settings.max_active_bookings_per_client then
    raise exception 'LIMITE_DE_AGENDAMENTOS' using errcode = 'P0001';
  end if;
  v_status := case when v_settings.auto_confirm then 'confirmed' else 'pending' end;
  v_ref := public.new_reference_code();
  begin
    insert into public.appointments (
      business_id, professional_id, service_id, client_id, starts_at, ends_at,
      prep_minutes, buffer_after_minutes, status, source, reference_code, manage_token_hash,
      service_name, price_cents, duration_minutes, client_message, confirmed_at,
      coupon_id, coupon_code, discount_cents, original_price_cents, extras
    ) values (
      p_business_id, v_prof, v_service.id, v_client_id, p_starts_at,
      p_starts_at + make_interval(mins => v_duration),
      v_service.prep_minutes, v_service.buffer_after_minutes, v_status, 'online', v_ref, p_manage_token_hash,
      case when v_extra_names is null then v_service.name else v_service.name || ' + ' || v_extra_names end,
      v_price + v_extra_price, v_duration, nullif(p_client_message, ''),
      case when v_status = 'confirmed' then now() end,
      v_coupon.coupon_id, v_coupon.code, coalesce(v_coupon.discount_cents, 0),
      case when v_coupon.coupon_id is not null or v_extras is not null then v_service.price_cents + v_extra_list end,
      v_extras
    ) returning id into v_id;
  exception when exclusion_violation then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = 'P0001';
  end;
  return query select v_id, v_ref, v_status;
end;
$$;

-- ---------------------------------------------------------------------
-- Remarcação pela cliente: considera a duração total (com serviços extras).
-- (mesma assinatura da função atual)
-- ---------------------------------------------------------------------
create or replace function public.reschedule_booking_by_token(p_token_hash text, p_new_start timestamptz)
returns table (appointment_id uuid, status public.appointment_status, starts_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_appt public.appointments%rowtype;
  v_settings public.booking_settings%rowtype;
  v_tz text;
  v_service public.services%rowtype;
  v_status public.appointment_status;
begin
  select * into v_appt from public.appointments a where a.manage_token_hash = p_token_hash;
  if not found then raise exception 'NAO_ENCONTRADO' using errcode = 'P0001'; end if;

  perform pg_advisory_xact_lock(hashtextextended('agenda:' || v_appt.professional_id::text, 0));
  select * into v_appt from public.appointments a where a.id = v_appt.id for update;

  select * into v_settings from public.booking_settings bs where bs.business_id = v_appt.business_id;
  select b.timezone into v_tz from public.businesses b where b.id = v_appt.business_id;

  if v_appt.status not in ('pending', 'confirmed') then raise exception 'STATUS_NAO_PERMITE' using errcode = 'P0001'; end if;
  if not v_settings.allow_client_reschedule then raise exception 'REAGENDAMENTO_DESATIVADO' using errcode = 'P0001'; end if;
  if v_appt.starts_at - now() < make_interval(hours => v_settings.reschedule_min_hours) then
    raise exception 'PRAZO_ENCERRADO' using errcode = 'P0001';
  end if;
  if v_appt.service_id is null then raise exception 'SERVICO_INDISPONIVEL' using errcode = 'P0001'; end if;

  select * into v_service from public.services s where s.id = v_appt.service_id;

  if not exists (
    select 1 from public.get_available_slots_v2(v_appt.business_id, v_appt.service_id,
                  (p_new_start at time zone v_tz)::date,
                  greatest(v_appt.duration_minutes - coalesce(v_service.duration_minutes, v_appt.duration_minutes), 0),
                  v_appt.id, true) gs
     where gs.slot_start = p_new_start
  ) then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = 'P0001';
  end if;

  v_status := case when v_settings.auto_confirm then 'confirmed' else 'pending' end;

  begin
    update public.appointments a
       set starts_at = p_new_start,
           ends_at = p_new_start + make_interval(mins => a.duration_minutes),
           status = v_status,
           confirmed_at = case when v_status = 'confirmed' then now() else null end,
           reschedule_count = a.reschedule_count + 1
     where a.id = v_appt.id;
  exception when exclusion_violation then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = 'P0001';
  end;

  return query select v_appt.id, v_status, p_new_start;
end;
$$;

-- ---------------------------------------------------------------------
-- Agendamento manual pelo painel: ao editar um agendamento com serviços
-- extras sem trocar o serviço, mantém a duração e o nome completos.
-- (mesma assinatura da função atual)
-- ---------------------------------------------------------------------
create or replace function public.admin_save_appointment(
  p_business_id uuid,
  p_appointment_id uuid,
  p_service_id uuid,
  p_client_id uuid,
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_status public.appointment_status,
  p_price_cents integer,
  p_notes text,
  p_allow_outside_hours boolean
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_service public.services%rowtype;
  v_prof uuid;
  v_end timestamptz;
  v_problem text;
  v_id uuid;
  v_existing public.appointments%rowtype;
  v_keep_extras boolean := false;
  v_duration integer;
  v_name text;
begin
  if not public.is_member(p_business_id) then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;

  select * into v_service from public.services s where s.id = p_service_id and s.business_id = p_business_id;
  if not found then raise exception 'SERVICO_INDISPONIVEL' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.clients c where c.id = p_client_id and c.business_id = p_business_id) then
    raise exception 'CLIENTE_NAO_ENCONTRADA' using errcode = 'P0001';
  end if;

  v_prof := coalesce(p_professional_id, public.service_professional(p_business_id, p_service_id));
  if v_prof is null or not exists (select 1 from public.professionals p where p.id = v_prof and p.business_id = p_business_id) then
    raise exception 'PROFISSIONAL_INVALIDO' using errcode = 'P0001';
  end if;

  if p_appointment_id is not null then
    select * into v_existing from public.appointments a where a.id = p_appointment_id and a.business_id = p_business_id;
    if not found then raise exception 'NAO_ENCONTRADO' using errcode = 'P0001'; end if;
    v_keep_extras := v_existing.extras is not null and v_existing.service_id = p_service_id;
  end if;

  v_duration := case when v_keep_extras then v_existing.duration_minutes else v_service.duration_minutes end;
  v_name := case when v_keep_extras then v_existing.service_name else v_service.name end;

  perform pg_advisory_xact_lock(hashtextextended('agenda:' || v_prof::text, 0));

  v_end := p_starts_at + make_interval(mins => v_duration);

  if p_status not in ('cancelled', 'no_show') then
    v_problem := public.check_slot(p_business_id, v_prof, p_starts_at, v_end,
                                   v_service.prep_minutes, v_service.buffer_after_minutes,
                                   p_appointment_id, not coalesce(p_allow_outside_hours, false));
    if v_problem is not null then
      raise exception '%', v_problem using errcode = 'P0001';
    end if;
  end if;

  begin
    if p_appointment_id is null then
      insert into public.appointments (
        business_id, professional_id, service_id, client_id, starts_at, ends_at,
        prep_minutes, buffer_after_minutes, status, source, reference_code,
        service_name, price_cents, duration_minutes, notes, created_by, confirmed_at
      ) values (
        p_business_id, v_prof, v_service.id, p_client_id, p_starts_at, v_end,
        v_service.prep_minutes, v_service.buffer_after_minutes, p_status, 'admin', public.new_reference_code(),
        v_service.name, coalesce(p_price_cents, v_service.price_cents), v_service.duration_minutes,
        nullif(p_notes, ''), auth.uid(), case when p_status = 'confirmed' then now() end
      ) returning id into v_id;
    else
      update public.appointments a set
        professional_id = v_prof,
        service_id = v_service.id,
        client_id = p_client_id,
        starts_at = p_starts_at,
        ends_at = v_end,
        prep_minutes = v_service.prep_minutes,
        buffer_after_minutes = v_service.buffer_after_minutes,
        service_name = v_name,
        duration_minutes = v_duration,
        extras = case when v_keep_extras then a.extras else null end,
        price_cents = coalesce(p_price_cents, a.price_cents),
        status = p_status,
        notes = nullif(p_notes, ''),
        reschedule_count = a.reschedule_count + case when a.starts_at <> p_starts_at then 1 else 0 end,
        confirmed_at = case when p_status = 'confirmed' and a.confirmed_at is null then now() else a.confirmed_at end
      where a.id = p_appointment_id
      returning id into v_id;
    end if;
  exception when exclusion_violation then
    raise exception 'CONFLITO' using errcode = 'P0001';
  end;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke execute on function public.get_available_slots_v2(uuid, uuid, date, integer, uuid, boolean) from public, anon;
revoke execute on function public.get_available_days_v2(uuid, uuid, date, date, integer, uuid) from public, anon;
revoke execute on function public.create_online_booking_v3(uuid, uuid, timestamptz, text, text, text, boolean, text, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.get_available_slots_v2(uuid, uuid, date, integer, uuid, boolean) to authenticated, service_role;
grant execute on function public.get_available_days_v2(uuid, uuid, date, date, integer, uuid) to authenticated, service_role;
grant execute on function public.create_online_booking_v3(uuid, uuid, timestamptz, text, text, text, boolean, text, text, text, uuid[]) to service_role;
