-- =====================================================================
-- Regras de disponibilidade e agendamento
-- Todos os cálculos de horário são feitos no fuso da empresa
-- (padrão America/Sao_Paulo), usando "timestamp AT TIME ZONE", o que
-- trata corretamente eventuais mudanças de horário de verão.
-- =====================================================================

-- Profissional responsável por um serviço (ou o primeiro ativo da empresa).
create or replace function public.service_professional(p_business_id uuid, p_service_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.professional_id from public.services s
       join public.professionals p on p.id = s.professional_id and p.active
      where s.id = p_service_id and s.business_id = p_business_id),
    (select p.id from public.professionals p
      where p.business_id = p_business_id and p.active
      order by p.created_at, p.id limit 1)
  );
$$;

-- ---------------------------------------------------------------------
-- check_slot: verifica se um intervalo pode ser reservado.
-- Retorna NULL quando livre, ou um código:
--   FECHADO | FORA_DO_HORARIO | INTERVALO | BLOQUEIO | CONFLITO
-- Regras:
--   * horário de funcionamento, almoço e bloqueios valem para o tempo de atendimento;
--   * conflitos com outros atendimentos consideram preparação + intervalo após;
--   * cancelados e faltas não ocupam a agenda.
-- ---------------------------------------------------------------------
create or replace function public.check_slot(
  p_business_id uuid,
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_prep_minutes integer default 0,
  p_buffer_minutes integer default 0,
  p_exclude_appointment_id uuid default null,
  p_check_hours boolean default true
) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_day date;
  v_is_open boolean;
  v_open time; v_close time; v_bs time; v_be time;
  v_special public.special_days%rowtype;
begin
  select b.timezone into v_tz from public.businesses b where b.id = p_business_id;
  if v_tz is null then return 'FECHADO'; end if;

  if p_check_hours then
    v_day := (p_starts_at at time zone v_tz)::date;

    select * into v_special from public.special_days sd
     where sd.professional_id = p_professional_id and sd.day = v_day;
    if found then
      if v_special.is_closed then return 'FECHADO'; end if;
      v_is_open := true;
      v_open := v_special.open_time; v_close := v_special.close_time;
      v_bs := v_special.break_start; v_be := v_special.break_end;
    else
      select w.is_open, w.open_time, w.close_time, w.break_start, w.break_end
        into v_is_open, v_open, v_close, v_bs, v_be
        from public.working_hours w
       where w.professional_id = p_professional_id and w.weekday = extract(dow from v_day)::int;
      if not coalesce(v_is_open, false) then return 'FECHADO'; end if;
    end if;

    if p_starts_at < ((v_day + v_open) at time zone v_tz)
       or p_ends_at > ((v_day + v_close) at time zone v_tz) then
      return 'FORA_DO_HORARIO';
    end if;

    if v_bs is not null and tstzrange(p_starts_at, p_ends_at) &&
       tstzrange((v_day + v_bs) at time zone v_tz, (v_day + v_be) at time zone v_tz) then
      return 'INTERVALO';
    end if;

    if exists (
      select 1 from public.time_blocks tb
       where tb.business_id = p_business_id
         and (tb.professional_id is null or tb.professional_id = p_professional_id)
         and tstzrange(tb.starts_at, tb.ends_at) && tstzrange(p_starts_at, p_ends_at)
    ) then
      return 'BLOQUEIO';
    end if;
  end if;

  if exists (
    select 1 from public.appointments a
     where a.professional_id = p_professional_id
       and a.status not in ('cancelled', 'no_show')
       and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
       and a.occupied && tstzrange(
             p_starts_at - make_interval(mins => p_prep_minutes),
             p_ends_at + make_interval(mins => p_buffer_minutes), '[)')
  ) then
    return 'CONFLITO';
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Horários disponíveis de um serviço em um dia (no fuso da empresa).
-- p_online = true aplica antecedência mínima e prazo máximo configurados.
-- ---------------------------------------------------------------------
create or replace function public.get_available_slots(
  p_business_id uuid,
  p_service_id uuid,
  p_day date,
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
  -- Usuárias logadas só consultam a agenda das próprias empresas.
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
  v_dur := make_interval(mins => v_service.duration_minutes);
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

-- Dias com pelo menos um horário livre (para o calendário público).
create or replace function public.get_available_days(
  p_business_id uuid,
  p_service_id uuid,
  p_from date,
  p_to date,
  p_exclude_appointment_id uuid default null
) returns setof date
language plpgsql stable security definer set search_path = '' as $$
declare d date;
begin
  if p_to - p_from > 62 then p_to := p_from + 62; end if;
  for d in select generate_series(p_from, p_to, interval '1 day')::date loop
    if exists (select 1 from public.get_available_slots(p_business_id, p_service_id, d, p_exclude_appointment_id, true)) then
      return next d;
    end if;
  end loop;
end;
$$;

-- Código de referência legível, sem caracteres ambíguos.
create or replace function public.new_reference_code()
returns text language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := 'AG-';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.appointments a where a.reference_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------
-- Agendamento online (chamado SOMENTE pelo servidor, com service role).
-- O token de gerenciamento é gerado no servidor; aqui só guardamos o hash.
-- ---------------------------------------------------------------------
create or replace function public.create_online_booking(
  p_business_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text,
  p_marketing_consent boolean,
  p_client_message text,
  p_manage_token_hash text
) returns table (appointment_id uuid, reference_code text, status public.appointment_status)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_settings public.booking_settings%rowtype;
  v_service public.services%rowtype;
  v_tz text;
  v_prof uuid;
  v_client_id uuid;
  v_active integer;
  v_status public.appointment_status;
  v_ref text;
  v_id uuid;
begin
  select * into v_settings from public.booking_settings bs where bs.business_id = p_business_id;
  if not found or not v_settings.online_enabled then
    raise exception 'AGENDAMENTO_DESATIVADO' using errcode = 'P0001';
  end if;

  select b.timezone into v_tz from public.businesses b where b.id = p_business_id;
  select * into v_service from public.services s
   where s.id = p_service_id and s.business_id = p_business_id and s.status = 'active' and s.show_online;
  if not found then raise exception 'SERVICO_INDISPONIVEL' using errcode = 'P0001'; end if;

  v_prof := public.service_professional(p_business_id, p_service_id);
  if v_prof is null then raise exception 'SERVICO_INDISPONIVEL' using errcode = 'P0001'; end if;

  -- Serializa reservas do mesmo profissional (evita corrida entre clientes).
  perform pg_advisory_xact_lock(hashtextextended('agenda:' || v_prof::text, 0));

  if not exists (
    select 1 from public.get_available_slots(p_business_id, p_service_id, (p_starts_at at time zone v_tz)::date, null, true) gs
     where gs.slot_start = p_starts_at
  ) then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = 'P0001';
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
      service_name, price_cents, duration_minutes, client_message, confirmed_at
    ) values (
      p_business_id, v_prof, v_service.id, v_client_id, p_starts_at,
      p_starts_at + make_interval(mins => v_service.duration_minutes),
      v_service.prep_minutes, v_service.buffer_after_minutes, v_status, 'online', v_ref, p_manage_token_hash,
      v_service.name, v_service.price_cents, v_service.duration_minutes, nullif(p_client_message, ''),
      case when v_status = 'confirmed' then now() end
    ) returning id into v_id;
  exception when exclusion_violation then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = 'P0001';
  end;

  return query select v_id, v_ref, v_status;
end;
$$;

-- Cancelamento pela cliente (link seguro).
create or replace function public.cancel_booking_by_token(p_token_hash text, p_reason text)
returns public.appointment_status
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_appt public.appointments%rowtype;
  v_settings public.booking_settings%rowtype;
begin
  select * into v_appt from public.appointments a where a.manage_token_hash = p_token_hash for update;
  if not found then raise exception 'NAO_ENCONTRADO' using errcode = 'P0001'; end if;
  select * into v_settings from public.booking_settings bs where bs.business_id = v_appt.business_id;

  if v_appt.status not in ('pending', 'confirmed') then raise exception 'STATUS_NAO_PERMITE' using errcode = 'P0001'; end if;
  if not v_settings.allow_client_cancel then raise exception 'CANCELAMENTO_DESATIVADO' using errcode = 'P0001'; end if;
  if v_appt.starts_at - now() < make_interval(hours => v_settings.cancel_min_hours) then
    raise exception 'PRAZO_ENCERRADO' using errcode = 'P0001';
  end if;

  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancelled_by = 'cliente', cancel_reason = nullif(p_reason, '')
   where id = v_appt.id;
  return 'cancelled';
end;
$$;

-- Reagendamento pela cliente (link seguro).
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

  if not exists (
    select 1 from public.get_available_slots(v_appt.business_id, v_appt.service_id,
                  (p_new_start at time zone v_tz)::date, v_appt.id, true) gs
     where gs.slot_start = p_new_start
  ) then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = 'P0001';
  end if;

  select * into v_service from public.services s where s.id = v_appt.service_id;
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
-- Agendamento manual pelo painel (usuária autenticada e membro da empresa).
-- p_allow_outside_hours permite "encaixe" fora do expediente/bloqueios,
-- mas NUNCA permite sobrepor outro atendimento do mesmo profissional.
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
  end if;

  perform pg_advisory_xact_lock(hashtextextended('agenda:' || v_prof::text, 0));

  v_end := p_starts_at + make_interval(mins => v_service.duration_minutes);

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
        service_name = v_service.name,
        duration_minutes = v_service.duration_minutes,
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

-- Alteração de status pelo painel, com validação de conflito ao reativar.
create or replace function public.admin_set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status,
  p_reason text default null
) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_appt public.appointments%rowtype;
begin
  select * into v_appt from public.appointments a where a.id = p_appointment_id;
  if not found or not public.is_member(v_appt.business_id) then
    raise exception 'NAO_ENCONTRADO' using errcode = 'P0001';
  end if;

  begin
    update public.appointments a set
      status = p_status,
      confirmed_at = case when p_status = 'confirmed' and a.confirmed_at is null then now() else a.confirmed_at end,
      completed_at = case when p_status = 'completed' then now() else null end,
      cancelled_at = case when p_status = 'cancelled' then now() else null end,
      cancelled_by = case when p_status = 'cancelled' then 'studio' else null end,
      cancel_reason = case when p_status = 'cancelled' then nullif(p_reason, '') else null end
    where a.id = p_appointment_id;
  exception when exclusion_violation then
    raise exception 'CONFLITO' using errcode = 'P0001';
  end;
end;
$$;

-- ---------------------------------------------------------------------
-- Indicadores do Painel de Controle (dados reais, no fuso da empresa)
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard(p_business_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_today date;
  v_day_start timestamptz; v_day_end timestamptz;
  v_month_start timestamptz; v_month_end timestamptz;
  v_result jsonb;
begin
  if not public.is_member(p_business_id) then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  select timezone into v_tz from public.businesses where id = p_business_id;
  v_today := (now() at time zone v_tz)::date;
  v_day_start := v_today::timestamp at time zone v_tz;
  v_day_end := (v_today + 1)::timestamp at time zone v_tz;
  v_month_start := date_trunc('month', v_today)::timestamp at time zone v_tz;
  v_month_end := (date_trunc('month', v_today) + interval '1 month')::timestamp at time zone v_tz;

  select jsonb_build_object(
    'hoje', (select count(*) from public.appointments a where a.business_id = p_business_id
               and a.starts_at >= v_day_start and a.starts_at < v_day_end and a.status not in ('cancelled')),
    'proximos', (select count(*) from public.appointments a where a.business_id = p_business_id
               and a.starts_at >= now() and a.status in ('pending', 'confirmed')),
    'pendentes', (select count(*) from public.appointments a where a.business_id = p_business_id
               and a.starts_at >= now() and a.status = 'pending'),
    'concluidos_mes', (select count(*) from public.appointments a where a.business_id = p_business_id
               and a.starts_at >= v_month_start and a.starts_at < v_month_end and a.status = 'completed'),
    'cancelados_mes', (select count(*) from public.appointments a where a.business_id = p_business_id
               and a.starts_at >= v_month_start and a.starts_at < v_month_end and a.status = 'cancelled'),
    'faltas_mes', (select count(*) from public.appointments a where a.business_id = p_business_id
               and a.starts_at >= v_month_start and a.starts_at < v_month_end and a.status = 'no_show'),
    'clientes', (select count(*) from public.clients c where c.business_id = p_business_id),
    'clientes_novas_mes', (select count(*) from public.clients c where c.business_id = p_business_id
               and c.created_at >= v_month_start and c.created_at < v_month_end),
    'recebido_mes_cents', (select coalesce(sum(case when p.kind = 'pagamento' then p.amount_cents else -p.amount_cents end), 0)
               from public.payments p where p.business_id = p_business_id
               and p.paid_at >= v_month_start and p.paid_at < v_month_end),
    'previsto_mes_cents', (select coalesce(sum(a.price_cents), 0) from public.appointments a
               where a.business_id = p_business_id and a.starts_at >= v_month_start and a.starts_at < v_month_end
               and a.status in ('pending', 'confirmed', 'in_progress', 'completed')),
    'ticket_medio_cents', (select coalesce(round(avg(a.price_cents)), 0) from public.appointments a
               where a.business_id = p_business_id and a.starts_at >= v_month_start and a.starts_at < v_month_end
               and a.status = 'completed'),
    'servicos_top', (select coalesce(jsonb_agg(t order by t.total desc), '[]'::jsonb) from (
               select a.service_name as nome, count(*) as total from public.appointments a
                where a.business_id = p_business_id and a.starts_at >= now() - interval '90 days'
                  and a.status not in ('cancelled')
                group by a.service_name order by count(*) desc limit 5) t)
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- Limitação de abuso em rotas públicas (janela fixa).
-- ---------------------------------------------------------------------
create or replace function public.rate_limit_hit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (bucket, window_start, hits) values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  -- Limpeza oportunista de janelas antigas.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões de execução
-- Funções públicas: SOMENTE service_role (servidor). Nunca anon.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

revoke execute on function public.create_online_booking(uuid, uuid, timestamptz, text, text, text, boolean, text, text) from authenticated;
revoke execute on function public.cancel_booking_by_token(text, text) from authenticated;
revoke execute on function public.reschedule_booking_by_token(text, timestamptz) from authenticated;
revoke execute on function public.rate_limit_hit(text, integer, integer) from authenticated;
revoke execute on function public.get_available_days(uuid, uuid, date, date, uuid) from authenticated;

grant execute on function public.create_online_booking(uuid, uuid, timestamptz, text, text, text, boolean, text, text) to service_role;
grant execute on function public.cancel_booking_by_token(text, text) to service_role;
grant execute on function public.reschedule_booking_by_token(text, timestamptz) to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.get_available_days(uuid, uuid, date, date, uuid) to service_role;
grant execute on function public.get_available_slots(uuid, uuid, date, uuid, boolean) to service_role, authenticated;

-- Funções do painel (validam is_member internamente).
grant execute on function public.admin_save_appointment(uuid, uuid, uuid, uuid, uuid, timestamptz, public.appointment_status, integer, text, boolean) to authenticated;
grant execute on function public.admin_set_appointment_status(uuid, public.appointment_status, text) to authenticated;
grant execute on function public.admin_dashboard(uuid) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
