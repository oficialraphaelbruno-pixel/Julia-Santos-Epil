-- =====================================================================
-- Administrador geral (plataforma) e permissões por área do painel.
-- O administrador geral (profiles.is_platform_admin) pode tudo e define,
-- por usuário, quais áreas podem ser editadas. Área ausente = liberada.
-- Áreas: site, servicos, ofertas, cupons, horarios, agendamento, legal,
--        integracoes, comunicacao, financeiro, exportar
-- =====================================================================

alter table public.business_members
  add column permissions jsonb not null default '{}'::jsonb;

-- Pode editar a área? (administrador geral sempre; proprietária se a área não estiver bloqueada)
create or replace function public.can_edit(p_business_id uuid, p_area text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_platform_admin() or exists (
    select 1 from public.business_members m
     where m.business_id = p_business_id and m.user_id = (select auth.uid()) and m.role = 'owner'
       and coalesce((m.permissions ->> p_area)::boolean, true)
  );
$$;
revoke execute on function public.can_edit(uuid, text) from public, anon;
grant execute on function public.can_edit(uuid, text) to authenticated, service_role;

-- Somente o administrador geral altera a equipe e as permissões
-- (antes qualquer proprietária podia; agora a equipe é gerida pela tela "Usuários e permissões").
create or replace function public.guard_business_members()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' and not public.is_platform_admin() then
    raise exception 'SEM_PERMISSAO' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger business_members_guard before insert or update or delete on public.business_members
  for each row execute function public.guard_business_members();

-- Trava genérica por área (vale só para usuárias logadas; o servidor com a chave secreta não é afetado).
create or replace function public.guard_area()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_business uuid;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then return coalesce(new, old); end if;
  v_business := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
  if not public.can_edit(v_business, tg_argv[0]) then
    raise exception 'AREA_BLOQUEADA' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger area_servicos before insert or update or delete on public.services
  for each row execute function public.guard_area('servicos');
create trigger area_servicos before insert or update or delete on public.service_categories
  for each row execute function public.guard_area('servicos');
create trigger area_servicos before insert or update or delete on public.service_combo_items
  for each row execute function public.guard_area('servicos');
create trigger area_ofertas before insert or update or delete on public.service_offers
  for each row execute function public.guard_area('ofertas');
create trigger area_cupons before insert or update or delete on public.coupons
  for each row execute function public.guard_area('cupons');
create trigger area_horarios before insert or update or delete on public.working_hours
  for each row execute function public.guard_area('horarios');
create trigger area_horarios before insert or update or delete on public.special_days
  for each row execute function public.guard_area('horarios');
create trigger area_agendamento before update on public.booking_settings
  for each row execute function public.guard_area('agendamento');
create trigger area_financeiro before insert or update or delete on public.expenses
  for each row execute function public.guard_area('financeiro');

-- Empresa: textos legais = área "legal"; demais dados e textos do site = área "site".
create or replace function public.guard_business_areas()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_legal text[] := array['privacy_policy', 'terms_of_use'];
  v_ignore text[] := array['updated_at', 'plan', 'billing_exempt'];
begin
  if coalesce(auth.role(), '') <> 'authenticated' then return new; end if;
  if (new.privacy_policy is distinct from old.privacy_policy or new.terms_of_use is distinct from old.terms_of_use)
     and not public.can_edit(new.id, 'legal') then
    raise exception 'AREA_BLOQUEADA' using errcode = '42501';
  end if;
  if (to_jsonb(new) - v_legal - v_ignore) is distinct from (to_jsonb(old) - v_legal - v_ignore)
     and not public.can_edit(new.id, 'site') then
    raise exception 'AREA_BLOQUEADA' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger area_empresa before update on public.businesses
  for each row execute function public.guard_business_areas();

-- Comunicação: liga/desliga do WhatsApp oficial = área "integracoes"; o resto = "comunicacao".
create or replace function public.guard_notification_areas()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_wa text[] := array['whatsapp_api_enabled', 'whatsapp_api_tested_at', 'updated_at'];
begin
  if coalesce(auth.role(), '') <> 'authenticated' then return new; end if;
  if new.whatsapp_api_enabled is distinct from old.whatsapp_api_enabled
     and not public.can_edit(new.business_id, 'integracoes') then
    raise exception 'AREA_BLOQUEADA' using errcode = '42501';
  end if;
  if (to_jsonb(new) - v_wa) is distinct from (to_jsonb(old) - v_wa)
     and not public.can_edit(new.business_id, 'comunicacao') then
    raise exception 'AREA_BLOQUEADA' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger area_comunicacao before update on public.notification_settings
  for each row execute function public.guard_notification_areas();

-- Despesas só aparecem para quem pode usar o Financeiro.
drop policy if exists "proprietaria le despesas" on public.expenses;
create policy "proprietaria le despesas" on public.expenses
  for select to authenticated using (public.is_owner(business_id) and public.can_edit(business_id, 'financeiro'));
