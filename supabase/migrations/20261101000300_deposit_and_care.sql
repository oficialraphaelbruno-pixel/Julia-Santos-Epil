-- =====================================================================
-- Sinal (Pix) no agendamento online + orientações pré/pós por serviço
-- =====================================================================

alter table public.booking_settings
  add column deposit_enabled boolean not null default false,
  add column deposit_percent integer not null default 50 check (deposit_percent between 1 and 100),
  add column deposit_deadline_hours integer not null default 24 check (deposit_deadline_hours between 1 and 168),
  add column pix_key text,
  add column pix_key_type text check (pix_key_type in ('telefone', 'cpf', 'cnpj', 'email', 'aleatoria')),
  add column pix_holder_name text,
  add column pix_bank text,
  add column pix_city text,
  add column deposit_instructions text;

alter table public.appointments
  add column deposit_cents integer not null default 0 check (deposit_cents >= 0),
  add column deposit_status text not null default 'nao_exigido'
    check (deposit_status in ('nao_exigido', 'aguardando', 'pago', 'dispensado', 'devolvido')),
  add column deposit_due_at timestamptz,
  add column deposit_paid_at timestamptz,
  add column terms_accepted_at timestamptz;

alter table public.services
  add column pre_care_text text,
  add column post_care_text text;

-- Agendamentos online: calcula o sinal conforme as regras vigentes.
-- Enquanto o sinal não for confirmado, o agendamento fica "pendente".
create or replace function public.appointments_set_deposit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_settings public.booking_settings%rowtype;
begin
  if new.source <> 'online' then return new; end if;
  new.terms_accepted_at := coalesce(new.terms_accepted_at, now());
  select * into v_settings from public.booking_settings bs where bs.business_id = new.business_id;
  if found and v_settings.deposit_enabled and new.price_cents > 0 then
    new.deposit_cents := round(new.price_cents * v_settings.deposit_percent / 100.0);
    new.deposit_status := 'aguardando';
    new.deposit_due_at := least(now() + make_interval(hours => v_settings.deposit_deadline_hours), new.starts_at);
    new.status := 'pending';
    new.confirmed_at := null;
  end if;
  return new;
end;
$$;
create trigger appointments_deposit before insert on public.appointments
  for each row execute function public.appointments_set_deposit();

-- Reagendamento pela cliente não deve "confirmar" um agendamento com sinal pendente.
create or replace function public.appointments_keep_pending_without_deposit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.deposit_status = 'aguardando' and new.status = 'confirmed' and old.status = 'pending'
     and coalesce(auth.role(), '') <> 'authenticated' then
    new.status := 'pending';
    new.confirmed_at := null;
  end if;
  return new;
end;
$$;
create trigger appointments_keep_pending before update of status on public.appointments
  for each row execute function public.appointments_keep_pending_without_deposit();

-- Dados do Pix da Julia Santos Epil (informados pela proprietária).
update public.booking_settings bs
   set deposit_enabled = true,
       deposit_percent = 50,
       pix_key = '+5531998628886',
       pix_key_type = 'telefone',
       pix_holder_name = 'Julia Caroline Pereira dos Santos',
       pix_bank = 'Banco Itaú S.A.'
  from public.businesses b
 where b.id = bs.business_id and b.slug = 'julia-santos-epil' and bs.pix_key is null;

revoke execute on function public.appointments_set_deposit() from public, anon, authenticated;
revoke execute on function public.appointments_keep_pending_without_deposit() from public, anon, authenticated;
