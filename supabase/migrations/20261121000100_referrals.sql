-- =====================================================================
-- Programa de indicação
-- * Cada cliente tem um código/link pessoal.
-- * A amiga indicada precisa ser cliente nova (sem cadastro anterior).
-- * Quando a amiga conclui o primeiro atendimento, quem indicou ganha um
--   desconto, aplicado automaticamente no próximo agendamento online.
-- * Cancelar o agendamento em que o desconto foi usado devolve o desconto.
-- Depende de 20261117000100_admin_permissions.sql (área "indicacoes").
-- =====================================================================

-- Configuração do programa (uma linha por empresa; começa desativado)
create table public.referral_programs (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  enabled boolean not null default false,
  reward_type text not null default 'percent' check (reward_type in ('percent', 'fixed')),
  reward_value integer not null default 10 check (reward_value > 0),
  friend_type text not null default 'percent' check (friend_type in ('percent', 'fixed')),
  friend_value integer not null default 0 check (friend_value >= 0),
  reward_valid_days integer check (reward_valid_days is null or reward_valid_days between 1 and 730),
  updated_at timestamptz not null default now(),
  check (reward_type <> 'percent' or reward_value <= 100),
  check (friend_type <> 'percent' or friend_value <= 100)
);
insert into public.referral_programs (business_id) select id from public.businesses on conflict do nothing;
create trigger referral_programs_updated_at before update on public.referral_programs
  for each row execute function public.set_updated_at();
create trigger audit_referral_programs after insert or update or delete on public.referral_programs
  for each row execute function public.audit_row_change();
create trigger area_indicacoes before insert or update or delete on public.referral_programs
  for each row execute function public.guard_area('indicacoes');

alter table public.referral_programs enable row level security;
revoke all on public.referral_programs from anon;
create policy "membros leem programa de indicacao" on public.referral_programs
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria altera programa de indicacao" on public.referral_programs
  for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));

-- Novas empresas já ganham a configuração (desativada)
create or replace function public.handle_new_business_referrals()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.referral_programs (business_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger businesses_referral_program after insert on public.businesses
  for each row execute function public.handle_new_business_referrals();

-- Clientes: código pessoal e quem indicou
alter table public.clients
  add column referral_code text check (referral_code is null or referral_code ~ '^[A-Z0-9]{4,20}$'),
  add column referred_by_client_id uuid;
alter table public.clients
  add constraint clients_referral_code_unique unique (business_id, referral_code),
  add constraint clients_referred_by_fk foreign key (business_id, referred_by_client_id)
    references public.clients (business_id, id) on delete set null (referred_by_client_id);

-- Indicações (cada cliente só pode ser indicada uma vez)
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  referrer_client_id uuid not null,
  referred_client_id uuid not null,
  appointment_id uuid references public.appointments (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'cancelled')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  foreign key (business_id, referrer_client_id) references public.clients (business_id, id) on delete cascade,
  foreign key (business_id, referred_client_id) references public.clients (business_id, id) on delete cascade,
  unique (business_id, referred_client_id),
  check (referrer_client_id <> referred_client_id)
);
create index referrals_referrer_idx on public.referrals (referrer_client_id);

-- Descontos ganhos por indicação
create table public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_id uuid not null,
  referral_id uuid not null unique references public.referrals (id) on delete cascade,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  status text not null default 'available' check (status in ('available', 'used', 'cancelled')),
  expires_at timestamptz,
  used_appointment_id uuid references public.appointments (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (business_id, client_id) references public.clients (business_id, id) on delete cascade
);
create index referral_rewards_client_idx on public.referral_rewards (client_id, status);

alter table public.appointments
  add column referral_discount_cents integer not null default 0 check (referral_discount_cents >= 0),
  add column referral_reward_id uuid references public.referral_rewards (id) on delete set null;

alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;
revoke all on public.referrals, public.referral_rewards from anon;
create policy "membros leem indicacoes" on public.referrals
  for select to authenticated using (public.is_member(business_id));
create policy "membros leem descontos de indicacao" on public.referral_rewards
  for select to authenticated using (public.is_member(business_id));
-- A proprietária pode cancelar/reativar manualmente um desconto (ex.: combinado com a cliente).
create policy "proprietaria altera descontos de indicacao" on public.referral_rewards
  for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));
create trigger audit_referrals after insert or update or delete on public.referrals
  for each row execute function public.audit_row_change();
create trigger audit_referral_rewards after insert or update or delete on public.referral_rewards
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------
-- Código pessoal da cliente (gerado na primeira vez): PRIMEIRO NOME + 4 caracteres
-- ---------------------------------------------------------------------
create or replace function public.client_referral_code(p_client_id uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_client public.clients%rowtype;
  v_base text; v_code text; v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; v_try int := 0;
begin
  select * into v_client from public.clients c where c.id = p_client_id;
  if not found then return null; end if;
  if coalesce(auth.role(), '') = 'authenticated' and not public.is_member(v_client.business_id) then return null; end if;
  if v_client.phone like '00%' then return null; end if; -- dados apagados (LGPD)
  if v_client.referral_code is not null then return v_client.referral_code; end if;
  v_base := upper(translate(split_part(trim(v_client.full_name), ' ', 1),
            'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));
  v_base := left(regexp_replace(v_base, '[^A-Z]', '', 'g'), 8);
  if length(v_base) < 2 then v_base := 'AMIGA'; end if;
  loop
    v_code := v_base;
    for i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      update public.clients set referral_code = v_code where id = p_client_id and referral_code is null;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 10 then raise; end if;
    end;
  end loop;
  return (select c.referral_code from public.clients c where c.id = p_client_id);
end;
$$;

-- Desconto calculado sobre um valor (percentual ou fixo, nunca acima do valor)
create or replace function public.referral_discount(p_type text, p_value integer, p_price integer)
returns integer language sql immutable set search_path = '' as $$
  select least(greatest(p_price, 0), case when p_type = 'percent' then round(p_price * p_value / 100.0)::int else p_value end);
$$;

-- ---------------------------------------------------------------------
-- Quando a amiga conclui o primeiro atendimento: indicação qualificada + desconto para quem indicou.
-- Quando um agendamento que usou desconto é cancelado/falta: o desconto volta.
-- ---------------------------------------------------------------------
create or replace function public.appointments_referral_events()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_ref public.referrals%rowtype; v_prog public.referral_programs%rowtype;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select * into v_ref from public.referrals r
     where r.business_id = new.business_id and r.referred_client_id = new.client_id and r.status = 'pending'
     for update;
    if found then
      select * into v_prog from public.referral_programs p where p.business_id = new.business_id;
      update public.referrals set status = 'qualified', qualified_at = now(), appointment_id = new.id where id = v_ref.id;
      insert into public.referral_rewards (business_id, client_id, referral_id, discount_type, discount_value, expires_at)
      values (new.business_id, v_ref.referrer_client_id, v_ref.id,
              coalesce(v_prog.reward_type, 'percent'), coalesce(v_prog.reward_value, 10),
              case when v_prog.reward_valid_days is not null then now() + make_interval(days => v_prog.reward_valid_days) end)
      on conflict (referral_id) do nothing;
    end if;
  end if;
  if new.status in ('cancelled', 'no_show') and old.status not in ('cancelled', 'no_show') and new.referral_reward_id is not null then
    update public.referral_rewards set status = 'available', used_appointment_id = null, used_at = null
     where id = new.referral_reward_id and status = 'used';
  end if;
  return new;
end;
$$;
create trigger appointments_referral after update of status on public.appointments
  for each row execute function public.appointments_referral_events();

-- ---------------------------------------------------------------------
-- Informações públicas de um código (primeiro nome de quem indicou + desconto da amiga)
-- ---------------------------------------------------------------------
create or replace function public.referral_code_info(p_business_id uuid, p_code text)
returns table (referrer_first_name text, friend_type text, friend_value integer)
language sql stable security definer set search_path = '' as $$
  select split_part(trim(c.full_name), ' ', 1), p.friend_type, p.friend_value
    from public.clients c
    join public.referral_programs p on p.business_id = c.business_id and p.enabled
   where c.business_id = p_business_id and c.referral_code = upper(trim(p_code))
     and c.blocked_at is null and c.phone not like '00%';
$$;

-- Prévia do desconto de indicação para a revisão do agendamento (sem consumir nada).
-- p_kind: 'reward' (desconto ganho por quem indicou) ou 'friend' (amiga nova indicada).
create or replace function public.referral_preview(
  p_business_id uuid, p_service_id uuid, p_phone text, p_email text, p_code text default null
) returns table (kind text, discount_cents integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_price integer; v_client public.clients%rowtype; v_reward public.referral_rewards%rowtype;
  v_prog public.referral_programs%rowtype; v_exists boolean; v_referrer uuid;
begin
  select s.price_cents into v_price from public.services s where s.id = p_service_id and s.business_id = p_business_id;
  if v_price is null then return; end if;
  select * into v_prog from public.referral_programs p where p.business_id = p_business_id;
  -- Cliente existente: desconto ganho (exige WhatsApp E e-mail iguais ao cadastro)
  select * into v_client from public.clients c
   where c.business_id = p_business_id and c.phone = p_phone
     and nullif(trim(coalesce(p_email, '')), '') is not null and lower(c.email) = lower(trim(p_email));
  if found then
    select * into v_reward from public.referral_rewards r
     where r.client_id = v_client.id and r.status = 'available' and (r.expires_at is null or r.expires_at > now())
     order by r.created_at limit 1;
    if found then
      return query select 'reward'::text, public.referral_discount(v_reward.discount_type, v_reward.discount_value, v_price);
    end if;
    return;
  end if;
  -- Amiga nova com código válido
  if nullif(trim(coalesce(p_code, '')), '') is null or not coalesce(v_prog.enabled, false) or coalesce(v_prog.friend_value, 0) = 0 then return; end if;
  select exists (
    select 1 from public.clients c where c.business_id = p_business_id
       and (c.phone = p_phone or (nullif(trim(coalesce(p_email, '')), '') is not null and lower(c.email) = lower(trim(p_email))))
  ) into v_exists;
  if v_exists then return; end if;
  select c.id into v_referrer from public.clients c
   where c.business_id = p_business_id and c.referral_code = upper(trim(p_code)) and c.blocked_at is null;
  if v_referrer is null then return; end if;
  return query select 'friend'::text, public.referral_discount(v_prog.friend_type, v_prog.friend_value, v_price);
end;
$$;

-- ---------------------------------------------------------------------
-- Agendamento online v4 = v3 + indicação (código da amiga e desconto ganho).
-- Descontos de indicação não acumulam com cupom (com cupom, o desconto ganho fica guardado).
-- ---------------------------------------------------------------------
create or replace function public.create_online_booking_v4(
  p_business_id uuid, p_service_id uuid, p_starts_at timestamptz, p_full_name text, p_phone text,
  p_email text, p_marketing_consent boolean, p_client_message text, p_manage_token_hash text,
  p_coupon_code text default null,
  p_offer_ids uuid[] default null,
  p_referral_code text default null
) returns table (appointment_id uuid, reference_code text, status public.appointment_status)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_settings public.booking_settings%rowtype;
  v_service public.services%rowtype;
  v_prog public.referral_programs%rowtype;
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
  v_was_client boolean;
  v_referrer uuid;
  v_reward public.referral_rewards%rowtype;
  v_ref_discount integer := 0;
  v_reward_id uuid;
begin
  select * into v_settings from public.booking_settings bs where bs.business_id = p_business_id;
  if not found or not v_settings.online_enabled then
    raise exception 'AGENDAMENTO_DESATIVADO' using errcode = 'P0001';
  end if;

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

  -- Já era cliente? (pelo WhatsApp ou e-mail) — a indicação só vale para clientes novas.
  select exists (
    select 1 from public.clients c where c.business_id = p_business_id
       and (c.phone = p_phone or (nullif(trim(coalesce(p_email, '')), '') is not null and lower(c.email) = lower(trim(p_email))))
  ) into v_was_client;
  select * into v_prog from public.referral_programs p where p.business_id = p_business_id;
  if not v_was_client and coalesce(v_prog.enabled, false) and nullif(trim(coalesce(p_referral_code, '')), '') is not null then
    select c.id into v_referrer from public.clients c
     where c.business_id = p_business_id and c.referral_code = upper(trim(p_referral_code))
       and c.blocked_at is null and c.phone <> p_phone
       and (nullif(trim(coalesce(p_email, '')), '') is null or c.email is null or lower(c.email) <> lower(trim(p_email)));
  end if;

  insert into public.clients (business_id, full_name, phone, email, privacy_accepted_at, marketing_consent, marketing_consent_at, source, referred_by_client_id)
  values (p_business_id, p_full_name, p_phone, nullif(p_email, ''), now(), coalesce(p_marketing_consent, false),
          case when p_marketing_consent then now() end, 'online', v_referrer)
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

  -- Descontos de indicação (não acumulam com cupom)
  if v_coupon.coupon_id is null then
    if v_referrer is not null and coalesce(v_prog.friend_value, 0) > 0 then
      v_ref_discount := public.referral_discount(v_prog.friend_type, v_prog.friend_value, v_price);
    elsif v_was_client then
      select * into v_reward from public.referral_rewards r
       where r.client_id = v_client_id and r.status = 'available' and (r.expires_at is null or r.expires_at > now())
       order by r.created_at limit 1 for update;
      if found then
        v_ref_discount := public.referral_discount(v_reward.discount_type, v_reward.discount_value, v_price);
        v_reward_id := v_reward.id;
      end if;
    end if;
  end if;

  v_status := case when v_settings.auto_confirm then 'confirmed' else 'pending' end;
  v_ref := public.new_reference_code();
  begin
    insert into public.appointments (
      business_id, professional_id, service_id, client_id, starts_at, ends_at,
      prep_minutes, buffer_after_minutes, status, source, reference_code, manage_token_hash,
      service_name, price_cents, duration_minutes, client_message, confirmed_at,
      coupon_id, coupon_code, discount_cents, original_price_cents, extras,
      referral_discount_cents, referral_reward_id
    ) values (
      p_business_id, v_prof, v_service.id, v_client_id, p_starts_at,
      p_starts_at + make_interval(mins => v_duration),
      v_service.prep_minutes, v_service.buffer_after_minutes, v_status, 'online', v_ref, p_manage_token_hash,
      case when v_extra_names is null then v_service.name else v_service.name || ' + ' || v_extra_names end,
      v_price - v_ref_discount + v_extra_price, v_duration, nullif(p_client_message, ''),
      case when v_status = 'confirmed' then now() end,
      v_coupon.coupon_id, v_coupon.code, coalesce(v_coupon.discount_cents, 0),
      case when v_coupon.coupon_id is not null or v_extras is not null or v_ref_discount > 0 then v_service.price_cents + v_extra_list end,
      v_extras, v_ref_discount, v_reward_id
    ) returning id into v_id;
  exception when exclusion_violation then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = 'P0001';
  end;

  if v_reward_id is not null then
    update public.referral_rewards set status = 'used', used_appointment_id = v_id, used_at = now() where id = v_reward_id;
  end if;
  if v_referrer is not null then
    insert into public.referrals (business_id, referrer_client_id, referred_client_id, appointment_id)
    values (p_business_id, v_referrer, v_client_id, v_id)
    on conflict (business_id, referred_client_id) do nothing;
  end if;

  return query select v_id, v_ref, v_status;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
revoke execute on function public.client_referral_code(uuid) from public, anon;
revoke execute on function public.referral_code_info(uuid, text) from public, anon, authenticated;
revoke execute on function public.referral_preview(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.create_online_booking_v4(uuid, uuid, timestamptz, text, text, text, boolean, text, text, text, uuid[], text) from public, anon, authenticated;
revoke execute on function public.referral_discount(text, integer, integer) from public, anon;
grant execute on function public.client_referral_code(uuid) to authenticated, service_role;
grant execute on function public.referral_code_info(uuid, text) to service_role;
grant execute on function public.referral_preview(uuid, uuid, text, text, text) to service_role;
grant execute on function public.create_online_booking_v4(uuid, uuid, timestamptz, text, text, text, boolean, text, text, text, uuid[], text) to service_role;
grant execute on function public.referral_discount(text, integer, integer) to authenticated, service_role;
