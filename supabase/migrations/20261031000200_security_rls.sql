-- =====================================================================
-- Segurança: Row Level Security, permissões e auditoria
-- Regra geral:
--   * anon (navegador sem login) NÃO acessa nenhuma tabela diretamente.
--   * O site público usa funções no servidor (service role), nunca no navegador.
--   * Usuárias autenticadas só enxergam dados das empresas das quais são membros.
-- =====================================================================

alter table public.businesses enable row level security;
alter table public.booking_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.business_members enable row level security;
alter table public.professionals enable row level security;
alter table public.working_hours enable row level security;
alter table public.special_days enable row level security;
alter table public.time_blocks enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.service_combo_items enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;

-- Defesa em profundidade: o papel anon não recebe privilégios de tabela.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- rate_limits e audit_logs não são graváveis por usuários.
revoke all on public.rate_limits from authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;

-- ---------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------
create policy "membros leem a empresa" on public.businesses
  for select to authenticated using (public.is_member(id) or public.is_platform_admin());
create policy "proprietaria atualiza a empresa" on public.businesses
  for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));
create policy "admin da plataforma gerencia empresas" on public.businesses
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Campos comerciais (plano, isenção) só podem ser alterados pela plataforma.
create or replace function public.protect_business_billing_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.plan is distinct from old.plan or new.billing_exempt is distinct from old.billing_exempt or new.slug is distinct from old.slug)
     and coalesce(auth.role(), '') = 'authenticated' and not public.is_platform_admin() then
    raise exception 'Somente a administração da plataforma pode alterar plano, isenção ou endereço público.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger businesses_protect_billing before update on public.businesses
  for each row execute function public.protect_business_billing_fields();

create policy "membros leem configuracoes de agendamento" on public.booking_settings
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria altera configuracoes de agendamento" on public.booking_settings
  for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));

-- ---------------------------------------------------------------------
-- Perfis e membros
-- ---------------------------------------------------------------------
create policy "usuaria le o proprio perfil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
-- Nenhuma política de insert/update: perfis são criados por gatilho e
-- o campo is_platform_admin só pode ser alterado pelo banco (service role).

create policy "membros veem a equipe" on public.business_members
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria gerencia equipe" on public.business_members
  for all to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));

-- ---------------------------------------------------------------------
-- Tabelas operacionais (membros da empresa)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['professionals','working_hours','special_days','time_blocks','service_categories',
                           'services','service_combo_items','clients','appointments','payments']
  loop
    execute format('create policy "membros leem" on public.%I for select to authenticated using (public.is_member(business_id))', t);
  end loop;

  -- Equipe pode operar agenda, clientes, bloqueios e pagamentos.
  foreach t in array array['time_blocks','clients','appointments','payments']
  loop
    execute format('create policy "membros inserem" on public.%I for insert to authenticated with check (public.is_member(business_id))', t);
    execute format('create policy "membros atualizam" on public.%I for update to authenticated using (public.is_member(business_id)) with check (public.is_member(business_id))', t);
  end loop;
  execute 'create policy "membros removem bloqueios" on public.time_blocks for delete to authenticated using (public.is_member(business_id))';
  execute 'create policy "proprietaria remove clientes" on public.clients for delete to authenticated using (public.is_owner(business_id))';
  execute 'create policy "proprietaria remove pagamentos" on public.payments for delete to authenticated using (public.is_owner(business_id))';

  -- Configurações do studio: somente proprietária.
  foreach t in array array['professionals','working_hours','special_days','service_categories','services','service_combo_items']
  loop
    execute format('create policy "proprietaria insere" on public.%I for insert to authenticated with check (public.is_owner(business_id))', t);
    execute format('create policy "proprietaria atualiza" on public.%I for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id))', t);
    execute format('create policy "proprietaria remove" on public.%I for delete to authenticated using (public.is_owner(business_id))', t);
  end loop;
end $$;

-- Agendamentos não são apagados: são cancelados (histórico preservado).
revoke delete on public.appointments from authenticated;

create policy "membros leem auditoria" on public.audit_logs
  for select to authenticated using (public.is_owner(business_id));

-- ---------------------------------------------------------------------
-- Gatilhos de criação automática
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_business()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.booking_settings (business_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_business_created after insert on public.businesses
  for each row execute function public.handle_new_business();

-- Cada profissional nasce com os 7 dias da semana FECHADOS:
-- a empresa configura seus horários reais no painel (nada é inventado).
create or replace function public.handle_new_professional()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.working_hours (business_id, professional_id, weekday, is_open)
  select new.business_id, new.id, d, false from generate_series(0, 6) d
  on conflict do nothing;
  return new;
end;
$$;
create trigger on_professional_created after insert on public.professionals
  for each row execute function public.handle_new_professional();

-- ---------------------------------------------------------------------
-- Auditoria de alterações críticas
-- ---------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_details jsonb;
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_actor uuid := auth.uid();
begin
  if tg_table_name = 'appointments' then
    if tg_op = 'UPDATE' and new.status is not distinct from old.status
       and new.starts_at is not distinct from old.starts_at and new.price_cents is not distinct from old.price_cents then
      return new; -- alterações irrelevantes (ex.: observações) não geram registro
    end if;
    v_details := jsonb_build_object(
      'status', jsonb_build_object('de', case when tg_op = 'UPDATE' then old.status end, 'para', new.status),
      'inicio', jsonb_build_object('de', case when tg_op = 'UPDATE' then old.starts_at end, 'para', new.starts_at),
      'referencia', new.reference_code
    );
  elsif tg_op = 'UPDATE' then
    select jsonb_object_agg(key, value) into v_details
    from jsonb_each(to_jsonb(new)) n
    where n.value is distinct from (to_jsonb(old) -> n.key) and key not in ('updated_at');
  else
    v_details := v_row;
  end if;

  insert into public.audit_logs (business_id, actor_id, actor_label, action, entity, entity_id, details)
  values (
    (v_row ->> 'business_id')::uuid,
    v_actor,
    case when v_actor is null then 'sistema/cliente online' else null end,
    lower(tg_op),
    tg_table_name,
    case when tg_table_name = 'business_members' then (v_row ->> 'user_id')::uuid else (v_row ->> 'id')::uuid end,
    v_details
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_appointments after insert or update on public.appointments
  for each row execute function public.audit_row_change();
create trigger audit_services after insert or update or delete on public.services
  for each row execute function public.audit_row_change();
create trigger audit_members after insert or update or delete on public.business_members
  for each row execute function public.audit_row_change();
create trigger audit_payments after insert or update or delete on public.payments
  for each row execute function public.audit_row_change();
create trigger audit_booking_settings after update on public.booking_settings
  for each row execute function public.audit_row_change();
create trigger audit_clients_delete after delete on public.clients
  for each row execute function public.audit_row_change();

-- booking_settings não possui coluna id; o gatilho usa business_id como entidade.
-- (entity_id fica nulo nesse caso, o que é esperado.)

-- ---------------------------------------------------------------------
-- Storage: imagens públicas da empresa (logo, fotos, serviços)
-- Caminho obrigatório: <business_id>/<arquivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-assets', 'business-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "proprietaria envia imagens" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'business-assets' and public.is_owner(((storage.foldername(name))[1])::uuid));
create policy "proprietaria atualiza imagens" on storage.objects
  for update to authenticated
  using (bucket_id = 'business-assets' and public.is_owner(((storage.foldername(name))[1])::uuid));
create policy "proprietaria remove imagens" on storage.objects
  for delete to authenticated
  using (bucket_id = 'business-assets' and public.is_owner(((storage.foldername(name))[1])::uuid));
