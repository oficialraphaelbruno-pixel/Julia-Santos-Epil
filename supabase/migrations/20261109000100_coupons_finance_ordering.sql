-- =====================================================================
-- Cupons de desconto, despesas/financeiro e ordem de exibição
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cupons
-- ---------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  once_per_client boolean not null default true,
  min_price_cents integer not null default 0 check (min_price_cents >= 0),
  valid_from date,
  valid_until date,
  service_ids uuid[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code),
  unique (business_id, id),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);
create trigger coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

alter table public.appointments
  add column coupon_id uuid,
  add column coupon_code text,
  add column discount_cents integer not null default 0 check (discount_cents >= 0),
  add column original_price_cents integer,
  add constraint appointments_coupon_fk foreign key (business_id, coupon_id)
    references public.coupons (business_id, id) on delete set null (coupon_id);
create index appointments_coupon_idx on public.appointments (coupon_id) where coupon_id is not null;

alter table public.coupons enable row level security;
revoke all on public.coupons from anon;
create policy "membros leem cupons" on public.coupons
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria insere cupons" on public.coupons
  for insert to authenticated with check (public.is_owner(business_id));
create policy "proprietaria altera cupons" on public.coupons
  for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));
create policy "proprietaria remove cupons" on public.coupons
  for delete to authenticated using (public.is_owner(business_id));

-- Validação do cupom. O uso conta agendamentos não cancelados
-- (cancelar um agendamento devolve o uso do cupom).
create or replace function public.coupon_check(
  p_business_id uuid,
  p_code text,
  p_service_id uuid,
  p_phone text,
  p_lock boolean default false
) returns table (coupon_id uuid, code text, discount_cents integer, original_cents integer, final_cents integer, error text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_c public.coupons%rowtype;
  v_price integer;
  v_tz text;
  v_today date;
  v_used integer;
  v_discount integer;
begin
  select s.price_cents into v_price from public.services s where s.id = p_service_id and s.business_id = p_business_id;
  if v_price is null then
    return query select null::uuid, null::text, 0, 0, 0, 'CUPOM_NAO_APLICAVEL'; return;
  end if;

  if p_lock then
    select * into v_c from public.coupons c
     where c.business_id = p_business_id and c.code = upper(trim(p_code)) for update;
  else
    select * into v_c from public.coupons c
     where c.business_id = p_business_id and c.code = upper(trim(p_code));
  end if;
  if not found or not v_c.active then
    return query select null::uuid, null::text, 0, v_price, v_price, 'CUPOM_INVALIDO'; return;
  end if;

  select b.timezone into v_tz from public.businesses b where b.id = p_business_id;
  v_today := (now() at time zone v_tz)::date;
  if (v_c.valid_from is not null and v_today < v_c.valid_from) or (v_c.valid_until is not null and v_today > v_c.valid_until) then
    return query select v_c.id, v_c.code, 0, v_price, v_price, 'CUPOM_EXPIRADO'; return;
  end if;
  if v_c.service_ids is not null and cardinality(v_c.service_ids) > 0 and not (p_service_id = any (v_c.service_ids)) then
    return query select v_c.id, v_c.code, 0, v_price, v_price, 'CUPOM_NAO_APLICAVEL'; return;
  end if;
  if v_price < v_c.min_price_cents then
    return query select v_c.id, v_c.code, 0, v_price, v_price, 'CUPOM_VALOR_MINIMO'; return;
  end if;

  if v_c.max_uses is not null then
    select count(*) into v_used from public.appointments a where a.coupon_id = v_c.id and a.status <> 'cancelled';
    if v_used >= v_c.max_uses then
      return query select v_c.id, v_c.code, 0, v_price, v_price, 'CUPOM_ESGOTADO'; return;
    end if;
  end if;
  if v_c.once_per_client and p_phone is not null and exists (
    select 1 from public.appointments a join public.clients cl on cl.id = a.client_id
     where a.coupon_id = v_c.id and a.status <> 'cancelled' and cl.phone = p_phone
  ) then
    return query select v_c.id, v_c.code, 0, v_price, v_price, 'CUPOM_JA_UTILIZADO'; return;
  end if;

  v_discount := case when v_c.discount_type = 'percent' then round(v_price * v_c.discount_value / 100.0) else v_c.discount_value end;
  v_discount := least(v_discount, v_price);
  return query select v_c.id, v_c.code, v_discount, v_price, v_price - v_discount, null::text;
end;
$$;

-- Agendamento online agora aceita cupom (validado e travado na mesma transação).
drop function if exists public.create_online_booking(uuid, uuid, timestamptz, text, text, text, boolean, text, text);
create or replace function public.create_online_booking(
  p_business_id uuid, p_service_id uuid, p_starts_at timestamptz, p_full_name text, p_phone text,
  p_email text, p_marketing_consent boolean, p_client_message text, p_manage_token_hash text,
  p_coupon_code text default null
) returns table (appointment_id uuid, reference_code text, status public.appointment_status)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_settings public.booking_settings%rowtype;
  v_service public.services%rowtype;
  v_tz text; v_prof uuid; v_client_id uuid; v_active integer;
  v_status public.appointment_status; v_ref text; v_id uuid;
  v_coupon record;
  v_price integer;
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
  perform pg_advisory_xact_lock(hashtextextended('agenda:' || v_prof::text, 0));
  if not exists (
    select 1 from public.get_available_slots(p_business_id, p_service_id, (p_starts_at at time zone v_tz)::date, null, true) gs
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
      coupon_id, coupon_code, discount_cents, original_price_cents
    ) values (
      p_business_id, v_prof, v_service.id, v_client_id, p_starts_at,
      p_starts_at + make_interval(mins => v_service.duration_minutes),
      v_service.prep_minutes, v_service.buffer_after_minutes, v_status, 'online', v_ref, p_manage_token_hash,
      v_service.name, v_price, v_service.duration_minutes, nullif(p_client_message, ''),
      case when v_status = 'confirmed' then now() end,
      v_coupon.coupon_id, v_coupon.code, coalesce(v_coupon.discount_cents, 0),
      case when v_coupon.coupon_id is not null then v_service.price_cents end
    ) returning id into v_id;
  exception when exclusion_violation then
    raise exception 'HORARIO_INDISPONIVEL' using errcode = 'P0001';
  end;
  return query select v_id, v_ref, v_status;
end;
$$;

-- ---------------------------------------------------------------------
-- Financeiro: despesas, receitas avulsas e comprovantes
-- ---------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  description text not null check (length(description) between 2 and 160),
  category text not null default 'Outros' check (length(category) between 2 and 60),
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  paid_at date,
  method public.payment_method,
  supplier text,
  notes text,
  receipt_path text,
  recurrence_group uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_business_due_idx on public.expenses (business_id, due_date);
create trigger expenses_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();
create trigger audit_expenses after insert or update or delete on public.expenses
  for each row execute function public.audit_row_change();

alter table public.expenses enable row level security;
revoke all on public.expenses from anon;
create policy "proprietaria le despesas" on public.expenses
  for select to authenticated using (public.is_owner(business_id));
create policy "proprietaria insere despesas" on public.expenses
  for insert to authenticated with check (public.is_owner(business_id));
create policy "proprietaria altera despesas" on public.expenses
  for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));
create policy "proprietaria remove despesas" on public.expenses
  for delete to authenticated using (public.is_owner(business_id));

-- Receitas avulsas (ex.: venda de produto) usam payments sem agendamento.
alter table public.payments add column description text;

-- Comprovantes: bucket PRIVADO (acesso só por link temporário).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
create policy "proprietaria envia comprovantes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.is_owner(((storage.foldername(name))[1])::uuid));
create policy "proprietaria le comprovantes" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.is_owner(((storage.foldername(name))[1])::uuid));
create policy "proprietaria remove comprovantes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and public.is_owner(((storage.foldername(name))[1])::uuid));

-- Resumo financeiro do mês (no fuso da empresa). Somente proprietária.
create or replace function public.admin_finance_summary(p_business_id uuid, p_month date)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text;
  v_m date := date_trunc('month', p_month)::date;
  v_start timestamptz; v_end timestamptz;
  v_today date;
  v_result jsonb;
begin
  if not public.is_owner(p_business_id) then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  select timezone into v_tz from public.businesses where id = p_business_id;
  v_today := (now() at time zone v_tz)::date;
  v_start := v_m::timestamp at time zone v_tz;
  v_end := (v_m + interval '1 month')::timestamp at time zone v_tz;

  with pay as (
    select p.*, a.service_name from public.payments p
      left join public.appointments a on a.id = p.appointment_id
     where p.business_id = p_business_id and p.paid_at >= v_start and p.paid_at < v_end
  ), appt as (
    select a.* from public.appointments a
     where a.business_id = p_business_id and a.starts_at >= v_start and a.starts_at < v_end
  ), exp as (
    select e.* from public.expenses e
     where e.business_id = p_business_id and e.due_date >= v_m and e.due_date < (v_m + interval '1 month')::date
  ), paid_by_appt as (
    select p.appointment_id, sum(case when p.kind = 'pagamento' then p.amount_cents + p.discount_cents else -p.amount_cents end) as paid
      from public.payments p where p.business_id = p_business_id and p.appointment_id is not null group by p.appointment_id
  ), months as (
    select generate_series(v_m - interval '5 months', v_m, interval '1 month')::date as m
  )
  select jsonb_build_object(
    'recebido_cents', (select coalesce(sum(amount_cents), 0) from pay where kind = 'pagamento'),
    'estornos_cents', (select coalesce(sum(amount_cents), 0) from pay where kind = 'estorno'),
    'despesas_pagas_cents', (select coalesce(sum(e.amount_cents), 0) from public.expenses e
        where e.business_id = p_business_id and e.paid_at >= v_m and e.paid_at < (v_m + interval '1 month')::date),
    'despesas_mes_cents', (select coalesce(sum(amount_cents), 0) from exp),
    'despesas_a_pagar_cents', (select coalesce(sum(amount_cents), 0) from exp where paid_at is null),
    'despesas_vencidas_cents', (select coalesce(sum(e.amount_cents), 0) from public.expenses e
        where e.business_id = p_business_id and e.paid_at is null and e.due_date < v_today),
    'despesas_vencidas_qtd', (select count(*) from public.expenses e
        where e.business_id = p_business_id and e.paid_at is null and e.due_date < v_today),
    'faturamento_previsto_cents', (select coalesce(sum(price_cents), 0) from appt where status not in ('cancelled', 'no_show')),
    'a_receber_cents', (select coalesce(sum(greatest(a.price_cents - coalesce(pb.paid, 0), 0)), 0)
        from appt a left join paid_by_appt pb on pb.appointment_id = a.id where a.status = 'completed'),
    'descontos_cupons_cents', (select coalesce(sum(discount_cents), 0) from appt where status <> 'cancelled'),
    'atendimentos_concluidos', (select count(*) from appt where status = 'completed'),
    'ticket_medio_cents', (select coalesce(round(avg(price_cents)), 0) from appt where status = 'completed'),
    'por_forma', (select coalesce(jsonb_agg(t order by t.total desc), '[]'::jsonb) from (
        select method::text as nome, sum(amount_cents) as total from pay where kind = 'pagamento' group by method) t),
    'por_servico', (select coalesce(jsonb_agg(t order by t.total desc), '[]'::jsonb) from (
        select coalesce(service_name, 'Receitas avulsas') as nome, sum(amount_cents) as total from pay where kind = 'pagamento'
         group by coalesce(service_name, 'Receitas avulsas') order by sum(amount_cents) desc limit 8) t),
    'despesas_por_categoria', (select coalesce(jsonb_agg(t order by t.total desc), '[]'::jsonb) from (
        select category as nome, sum(amount_cents) as total from exp group by category) t),
    'serie', (select jsonb_agg(jsonb_build_object(
        'mes', to_char(mo.m, 'YYYY-MM'),
        'receitas', (select coalesce(sum(case when p.kind = 'pagamento' then p.amount_cents else -p.amount_cents end), 0)
                       from public.payments p where p.business_id = p_business_id
                        and p.paid_at >= (mo.m::timestamp at time zone v_tz) and p.paid_at < ((mo.m + interval '1 month')::timestamp at time zone v_tz)),
        'despesas', (select coalesce(sum(e.amount_cents), 0) from public.expenses e
                       where e.business_id = p_business_id and e.paid_at >= mo.m and e.paid_at < (mo.m + interval '1 month')::date)
      ) order by mo.m) from months mo)
  ) into v_result;
  return v_result;
end;
$$;

-- Permissões
revoke execute on function public.coupon_check(uuid, text, uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.create_online_booking(uuid, uuid, timestamptz, text, text, text, boolean, text, text, text) from public, anon, authenticated;
revoke execute on function public.admin_finance_summary(uuid, date) from public, anon;
grant execute on function public.coupon_check(uuid, text, uuid, text, boolean) to service_role;
grant execute on function public.create_online_booking(uuid, uuid, timestamptz, text, text, text, boolean, text, text, text) to service_role;
grant execute on function public.admin_finance_summary(uuid, date) to authenticated, service_role;
