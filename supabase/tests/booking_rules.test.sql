-- Testes das regras de agendamento e isolamento entre empresas.
-- Executar: npm run test:db   (roda dentro de uma transação e desfaz tudo ao final)
\set ON_ERROR_STOP on
begin;

-- ---------- Preparação: duas empresas, duas usuárias ----------
insert into auth.users (id, email, aud, role, instance_id)
values ('00000000-0000-0000-0000-0000000000a1', 'dona-a@teste.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
       ('00000000-0000-0000-0000-0000000000b1', 'dona-b@teste.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

insert into public.businesses (id, slug, name) values
  ('00000000-0000-0000-0000-00000000000a', 'empresa-teste-a', 'Empresa A'),
  ('00000000-0000-0000-0000-00000000000b', 'empresa-teste-b', 'Empresa B');
insert into public.business_members values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner', now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner', now());
insert into public.professionals (id, business_id, display_name) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'Profissional A'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000b', 'Profissional B');

-- Teste 2: horários de funcionamento (todos os dias 09:00–18:00, almoço 12:00–13:00)
update public.working_hours set is_open = true, open_time = '09:00', close_time = '18:00',
       break_start = '12:00', break_end = '13:00';
update public.booking_settings set min_advance_minutes = 0, slot_interval_minutes = 30, max_advance_days = 60;

-- Teste 1: cadastro de serviço (60 min, 10 min de preparação, 10 min após)
insert into public.services (id, business_id, name, price_cents, duration_minutes, prep_minutes, buffer_after_minutes)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'Serviço Teste', 8000, 60, 10, 10),
       ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000b', 'Serviço B', 5000, 30, 0, 0);

create temp table t_ctx as select ((now() at time zone 'America/Sao_Paulo')::date + 7) as d;
grant select on t_ctx to authenticated;

do $$
declare
  v_day date := (select d from t_ctx);
  v_slots int; v_first timestamptz; v_r record; v_ok boolean;
  v_slot timestamptz;
begin
  -- 09:00..11:00 cabem antes do almoço (11:00+60=12:00), 13:00..17:00 depois → 5 + 9 = 14
  select count(*), min(slot_start) into v_slots, v_first
    from public.get_available_slots('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', v_day);
  assert v_slots = 14, format('esperava 14 horários, obtive %s', v_slots);
  assert v_first = (v_day + time '09:00') at time zone 'America/Sao_Paulo', 'primeiro horário deveria ser 09:00 local';
  raise notice 'OK teste 4: % horários livres, primeiro às %', v_slots, v_first at time zone 'America/Sao_Paulo';

  -- Teste 5: agendamento online salvo
  v_slot := (v_day + time '10:00') at time zone 'America/Sao_Paulo';
  select * into v_r from public.create_online_booking('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
           v_slot, 'Cliente Um', '5531999990001', 'um@teste.local', true, null, 'hash-1');
  assert v_r.reference_code like 'AG-%', 'referência inválida';
  assert v_r.status = 'pending', 'sem confirmação automática deveria ficar pendente';
  raise notice 'OK teste 5: agendamento % salvo', v_r.reference_code;

  -- Teste 7: mesmo horário para outra cliente deve falhar
  begin
    perform public.create_online_booking('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
           v_slot, 'Cliente Dois', '5531999990002', null, false, null, 'hash-2');
    raise exception 'FALHOU: permitiu reserva duplicada';
  exception when others then
    assert sqlerrm = 'HORARIO_INDISPONIVEL', 'erro inesperado: ' || sqlerrm;
  end;
  -- 10:30 também colide (atendimento 10:00–11:00 + 10 min após)
  begin
    perform public.create_online_booking('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
           v_slot + interval '30 minutes', 'Cliente Dois', '5531999990002', null, false, null, 'hash-2');
    raise exception 'FALHOU: permitiu sobreposição parcial';
  exception when others then
    assert sqlerrm = 'HORARIO_INDISPONIVEL', 'erro inesperado: ' || sqlerrm;
  end;
  -- 11:00 colide por causa da preparação (10 min antes) + intervalo após (10 min)
  assert not exists (select 1 from public.get_available_slots('00000000-0000-0000-0000-00000000000a',
     '00000000-0000-0000-0000-0000000000c1', v_day) where slot_start = v_slot + interval '1 hour'),
     '11:00 deveria estar bloqueado pela preparação/intervalo';
  raise notice 'OK teste 7: horário duplicado e sobreposição recusados';

  -- Restrição do banco: mesmo com inserção direta, não há sobreposição
  begin
    insert into public.appointments (business_id, professional_id, service_id, client_id, starts_at, ends_at,
      reference_code, service_name, price_cents, duration_minutes, status)
    select '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', null, c.id,
           v_slot + interval '15 minutes', v_slot + interval '45 minutes', 'AG-TESTE1', 'X', 0, 30, 'confirmed'
      from public.clients c where c.phone = '5531999990001';
    raise exception 'FALHOU: restrição de exclusão não atuou';
  exception when exclusion_violation then null;
  end;
  raise notice 'OK restrição EXCLUDE do PostgreSQL ativa';

  -- Teste 8: cancelamento pela cliente libera o horário
  perform public.cancel_booking_by_token('hash-1', 'teste');
  assert exists (select 1 from public.get_available_slots('00000000-0000-0000-0000-00000000000a',
     '00000000-0000-0000-0000-0000000000c1', v_day) where slot_start = v_slot), 'cancelado não deveria bloquear';
  raise notice 'OK teste 8a: cancelamento libera o horário';

  -- Reagendamento: nova reserva e troca de horário
  perform public.create_online_booking('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
           v_slot, 'Cliente Dois', '5531999990002', null, false, null, 'hash-3');
  select * into v_r from public.reschedule_booking_by_token('hash-3', (v_day + time '14:00') at time zone 'America/Sao_Paulo');
  assert v_r.starts_at = (v_day + time '14:00') at time zone 'America/Sao_Paulo', 'reagendamento falhou';
  assert exists (select 1 from public.get_available_slots('00000000-0000-0000-0000-00000000000a',
     '00000000-0000-0000-0000-0000000000c1', v_day) where slot_start = v_slot), 'horário antigo deveria ser liberado';
  raise notice 'OK teste 8b: reagendamento move o horário e libera o anterior';

  -- Bloqueio de horário
  insert into public.time_blocks (business_id, starts_at, ends_at, reason)
  values ('00000000-0000-0000-0000-00000000000a', (v_day + time '15:00') at time zone 'America/Sao_Paulo',
          (v_day + time '16:00') at time zone 'America/Sao_Paulo', 'teste');
  assert not exists (select 1 from public.get_available_slots('00000000-0000-0000-0000-00000000000a',
     '00000000-0000-0000-0000-0000000000c1', v_day) where slot_start in (
        (v_day + time '14:30') at time zone 'America/Sao_Paulo', (v_day + time '15:00') at time zone 'America/Sao_Paulo')),
     'bloqueio não respeitado';
  raise notice 'OK bloqueio de horário respeitado';

  -- Dia fechado (dia especial)
  insert into public.special_days (business_id, professional_id, day, is_closed)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', v_day + 1, true);
  assert not exists (select 1 from public.get_available_slots('00000000-0000-0000-0000-00000000000a',
     '00000000-0000-0000-0000-0000000000c1', v_day + 1)), 'feriado não respeitado';
  raise notice 'OK feriado/dia fechado respeitado';

  -- Antecedência máxima
  assert not exists (select 1 from public.get_available_slots('00000000-0000-0000-0000-00000000000a',
     '00000000-0000-0000-0000-0000000000c1', v_day + 90)), 'prazo máximo não respeitado';
  raise notice 'OK prazo máximo de agendamento respeitado';
end $$;

-- ---------- Sinal (Pix) ----------
do $$
declare v_day date := (select d from t_ctx) + 2; v_r record; v_a public.appointments%rowtype;
begin
  update public.booking_settings set deposit_enabled = true, deposit_percent = 50, auto_confirm = true, deposit_deadline_hours = 24
   where business_id = '00000000-0000-0000-0000-00000000000a';
  select * into v_r from public.create_online_booking('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
           (v_day + time '09:00') at time zone 'America/Sao_Paulo', 'Cliente Sinal', '5531999990009', null, false, null, 'hash-sinal');
  select * into v_a from public.appointments where id = v_r.appointment_id;
  assert v_a.deposit_cents = 4000, format('sinal deveria ser 4000, foi %s', v_a.deposit_cents);
  assert v_a.deposit_status = 'aguardando', 'sinal deveria estar aguardando';
  assert v_a.status = 'pending', 'com sinal pendente o agendamento deve ficar pendente mesmo com confirmação automática';
  assert v_a.terms_accepted_at is not null, 'aceite dos termos não registrado';
  assert v_a.deposit_due_at <= v_a.starts_at, 'prazo do sinal após o atendimento';
  -- reagendar pela cliente mantém pendente
  perform public.reschedule_booking_by_token('hash-sinal', (v_day + time '10:00') at time zone 'America/Sao_Paulo');
  assert (select status from public.appointments where id = v_r.appointment_id) = 'pending', 'reagendamento confirmou sem sinal';
  update public.booking_settings set deposit_enabled = false, auto_confirm = false where business_id = '00000000-0000-0000-0000-00000000000a';
  raise notice 'OK sinal: 50%% calculado, agendamento pendente até confirmar o Pix';
end $$;

-- ---------- Teste 14: isolamento entre empresas (RLS) ----------
insert into public.clients (business_id, full_name, phone)
values ('00000000-0000-0000-0000-00000000000b', 'Cliente da B', '5511988887777');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

do $$
declare n int;
begin
  select count(*) into n from public.clients where business_id = '00000000-0000-0000-0000-00000000000b';
  assert n = 0, 'FALHOU: usuária A enxergou clientes da empresa B';
  select count(*) into n from public.clients;
  assert n = 3, format('usuária A deveria ver 3 clientes próprias, viu %s', n);
  select count(*) into n from public.appointments where business_id = '00000000-0000-0000-0000-00000000000b';
  assert n = 0, 'FALHOU: viu agendamentos de B';
  select count(*) into n from public.businesses;
  assert n = 1, 'FALHOU: viu outras empresas';

  -- Escrita cruzada recusada
  begin
    insert into public.clients (business_id, full_name, phone) values ('00000000-0000-0000-0000-00000000000b', 'Invasora', '5511900000000');
    raise exception 'FALHOU: inseriu cliente em outra empresa';
  exception when insufficient_privilege then null;
  end;
  update public.clients set notes = 'x' where business_id = '00000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  assert n = 0, 'FALHOU: alterou cliente de outra empresa';

  -- Funções do painel validam a empresa
  begin
    perform public.admin_dashboard('00000000-0000-0000-0000-00000000000b');
    raise exception 'FALHOU: painel de outra empresa';
  exception when insufficient_privilege then null;
  end;
  assert not exists (select 1 from public.get_available_slots('00000000-0000-0000-0000-00000000000b',
      '00000000-0000-0000-0000-0000000000c2', (select d from t_ctx))), 'FALHOU: consultou agenda de outra empresa';

  -- Plano/isenção não podem ser alterados pela própria empresa
  begin
    update public.businesses set plan = 'premium' where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'FALHOU: alterou o próprio plano';
  exception when insufficient_privilege then null;
  end;

  -- Funções públicas não podem ser chamadas por usuárias comuns
  begin
    perform public.cancel_booking_by_token('hash-3', null);
    raise exception 'FALHOU: executou função restrita';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK teste 14: dados de uma empresa não ficam acessíveis à outra';
end $$;

reset role;

-- anon não lê nada
set local role anon;
do $$
begin
  begin
    perform 1 from public.clients limit 1;
    raise exception 'FALHOU: anon leu clientes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_available_slots('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', current_date);
    raise exception 'FALHOU: anon executou função';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK teste 11 (banco): visitante anônimo não acessa tabelas nem funções';
end $$;
reset role;

-- Auditoria registrou alterações críticas
do $$
begin
  assert (select count(*) from public.audit_logs where entity = 'appointments') >= 3, 'auditoria não registrou';
  raise notice 'OK auditoria de agendamentos registrada';
end $$;

rollback;
