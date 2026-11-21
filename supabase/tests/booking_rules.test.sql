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

-- ---------- Cupons ----------
do $$
declare v_day date := (select d from t_ctx) + 3; v_r record; v_a public.appointments%rowtype; v_c record;
begin
  insert into public.coupons (business_id, code, discount_type, discount_value, max_uses, once_per_client)
  values ('00000000-0000-0000-0000-00000000000a', 'BEMVINDA10', 'percent', 10, 2, true),
         ('00000000-0000-0000-0000-00000000000a', 'VENCIDO', 'fixed', 1000, null, false);
  update public.coupons set valid_until = current_date - 2 where code = 'VENCIDO';

  select * into v_c from public.coupon_check('00000000-0000-0000-0000-00000000000a', 'bemvinda10', '00000000-0000-0000-0000-0000000000c1', '5531911110001');
  assert v_c.error is null and v_c.discount_cents = 800 and v_c.final_cents = 7200, format('prévia errada: %s', row_to_json(v_c));
  select * into v_c from public.coupon_check('00000000-0000-0000-0000-00000000000a', 'VENCIDO', '00000000-0000-0000-0000-0000000000c1', null);
  assert v_c.error = 'CUPOM_EXPIRADO', 'cupom vencido aceito';
  select * into v_c from public.coupon_check('00000000-0000-0000-0000-00000000000a', 'NAOEXISTE', '00000000-0000-0000-0000-0000000000c1', null);
  assert v_c.error = 'CUPOM_INVALIDO', 'cupom inexistente aceito';

  -- uso 1 (cliente 1)
  select * into v_r from public.create_online_booking_v2('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
     (v_day + time '09:00') at time zone 'America/Sao_Paulo', 'Cliente Cupom Um', '5531911110001', null, false, null, 'hash-cup-1', 'BEMVINDA10');
  select * into v_a from public.appointments where id = v_r.appointment_id;
  assert v_a.price_cents = 7200 and v_a.discount_cents = 800 and v_a.original_price_cents = 8000 and v_a.coupon_code = 'BEMVINDA10', 'desconto não gravado';

  -- mesma cliente não pode reutilizar
  begin
    perform public.create_online_booking_v2('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
       (v_day + time '13:00') at time zone 'America/Sao_Paulo', 'Cliente Cupom Um', '5531911110001', null, false, null, 'hash-cup-x', 'BEMVINDA10');
    raise exception 'FALHOU: reutilizou cupom';
  exception when others then assert sqlerrm = 'CUPOM_JA_UTILIZADO', sqlerrm; end;

  -- uso 2 (cliente 2) e esgotado para cliente 3
  perform public.create_online_booking_v2('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
     (v_day + time '14:00') at time zone 'America/Sao_Paulo', 'Cliente Cupom Dois', '5531911110002', null, false, null, 'hash-cup-2', 'BEMVINDA10');
  begin
    perform public.create_online_booking_v2('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
       (v_day + time '16:00') at time zone 'America/Sao_Paulo', 'Cliente Cupom Tres', '5531911110003', null, false, null, 'hash-cup-3', 'BEMVINDA10');
    raise exception 'FALHOU: passou do limite de usos';
  exception when others then assert sqlerrm = 'CUPOM_ESGOTADO', sqlerrm; end;

  -- cancelar devolve o uso
  perform public.cancel_booking_by_token('hash-cup-2', null);
  select * into v_c from public.coupon_check('00000000-0000-0000-0000-00000000000a', 'BEMVINDA10', '00000000-0000-0000-0000-0000000000c1', '5531911110003');
  assert v_c.error is null, 'cancelamento não devolveu o uso: ' || coalesce(v_c.error, '');
  raise notice 'OK cupons: desconto, validade, limite de usos, 1 por cliente e devolução ao cancelar';
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
  assert n = 5, format('usuária A deveria ver 5 clientes próprias, viu %s', n);
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

-- ---------- Ofertas (order bump), bloqueio e remarcação com serviço extra ----------
insert into public.services (id, business_id, name, price_cents, duration_minutes)
values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-00000000000a', 'Extra Teste', 3000, 30);
insert into public.service_offers (id, business_id, service_id, offer_service_id, offer_price_cents)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c3', 2000);

do $$
declare
  v_day date := (select d from t_ctx) + 5;
  v_base int; v_extra int; v_r record; v_a public.appointments%rowtype;
begin
  select count(*) into v_base from public.get_available_slots_v2('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', v_day, 0);
  select count(*) into v_extra from public.get_available_slots_v2('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', v_day, 30);
  assert v_extra < v_base, format('minutos extras não reduziram os horários (%s/%s)', v_extra, v_base);
  assert not exists (select 1 from public.get_available_slots_v2('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', v_day, 30) g
                      where g.slot_start = (v_day + time '11:00') at time zone 'America/Sao_Paulo'), '11:00 + 90 min invadiu o almoço';

  select * into v_r from public.create_online_booking_v3('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
     (v_day + time '09:00') at time zone 'America/Sao_Paulo', 'Cliente Oferta', '5531922220001', 'oferta@teste.local', false, null, 'hash-oferta',
     null, array['00000000-0000-0000-0000-0000000000e1']::uuid[]);
  select * into v_a from public.appointments where id = v_r.appointment_id;
  assert v_a.price_cents = 10000 and v_a.duration_minutes = 90 and v_a.original_price_cents = 11000, format('oferta não somada: %s/%s/%s', v_a.price_cents, v_a.duration_minutes, v_a.original_price_cents);
  assert v_a.ends_at = v_a.starts_at + interval '90 minutes', 'fim não considera o extra';
  assert v_a.service_name = 'Serviço Teste + Extra Teste' and jsonb_array_length(v_a.extras) = 1, 'nome/extras não gravados';

  begin
    perform public.create_online_booking_v3('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c3',
       (v_day + time '15:00') at time zone 'America/Sao_Paulo', 'Cliente Oferta Dois', '5531922220002', null, false, null, 'hash-oferta-2',
       null, array['00000000-0000-0000-0000-0000000000e1']::uuid[]);
    raise exception 'FALHOU: aceitou oferta de outro serviço';
  exception when others then assert sqlerrm = 'OFERTA_INDISPONIVEL', sqlerrm; end;

  -- remarcação pela cliente respeita a duração total (90 min)
  begin
    perform public.reschedule_booking_by_token('hash-oferta', (v_day + time '11:00') at time zone 'America/Sao_Paulo');
    raise exception 'FALHOU: remarcou invadindo o almoço';
  exception when others then assert sqlerrm = 'HORARIO_INDISPONIVEL', sqlerrm; end;
  perform public.reschedule_booking_by_token('hash-oferta', (v_day + time '13:00') at time zone 'America/Sao_Paulo');
  select * into v_a from public.appointments where id = v_r.appointment_id;
  assert v_a.ends_at = (v_day + time '14:30') at time zone 'America/Sao_Paulo', 'remarcação perdeu a duração do extra';

  -- bloqueio: por WhatsApp e por e-mail
  insert into public.clients (business_id, full_name, phone, email, blocked_at, blocked_reason)
  values ('00000000-0000-0000-0000-00000000000a', 'Cliente Bloqueada', '5531933330001', 'bloqueada@teste.local', now(), 'teste');
  begin
    perform public.create_online_booking_v3('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
       (v_day + time '16:00') at time zone 'America/Sao_Paulo', 'Cliente Bloqueada', '5531933330001', null, false, null, 'hash-bloq-1');
    raise exception 'FALHOU: bloqueada agendou pelo WhatsApp';
  exception when others then assert sqlerrm = 'CLIENTE_BLOQUEADO', sqlerrm; end;
  begin
    perform public.create_online_booking_v3('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
       (v_day + time '16:00') at time zone 'America/Sao_Paulo', 'Outro Nome', '5531933339999', 'Bloqueada@Teste.local', false, null, 'hash-bloq-2');
    raise exception 'FALHOU: bloqueada agendou com outro número';
  exception when others then assert sqlerrm = 'CLIENTE_BLOQUEADO', sqlerrm; end;
  raise notice 'OK ofertas (order bump): preço e duração somados, validação, remarcação com extra e bloqueio de cliente';
end $$;

-- edição pelo painel mantém os serviços extras
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
declare v_id uuid; v_a public.appointments%rowtype; v_day date := (select d from t_ctx) + 5;
begin
  select id into v_id from public.appointments where manage_token_hash = 'hash-oferta';
  perform public.admin_save_appointment('00000000-0000-0000-0000-00000000000a', v_id, '00000000-0000-0000-0000-0000000000c1',
    (select client_id from public.appointments where id = v_id), null, (v_day + time '14:30') at time zone 'America/Sao_Paulo',
    'confirmed', null, 'editado', false);
  select * into v_a from public.appointments where id = v_id;
  assert v_a.duration_minutes = 90 and v_a.extras is not null and v_a.service_name = 'Serviço Teste + Extra Teste', 'edição perdeu o extra';
  assert v_a.ends_at = (v_day + time '16:00') at time zone 'America/Sao_Paulo', 'edição calculou o fim sem o extra';
  raise notice 'OK edição pelo painel mantém serviços extras';
end $$;
reset role;

-- ---------- Programa de indicação ----------
select set_config('request.jwt.claims', '', true);
update public.referral_programs set enabled = true, reward_type = 'percent', reward_value = 10, friend_type = 'percent', friend_value = 5
 where business_id = '00000000-0000-0000-0000-00000000000a';
insert into public.clients (id, business_id, full_name, phone, email)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'Márcia Indicadora', '5531944440001', 'indicadora@teste.local');

do $$
declare
  v_day date := (select d from t_ctx) + 9;
  v_code text; v_r record; v_a public.appointments%rowtype; v_rw public.referral_rewards%rowtype; v_p record; v_friend uuid;
begin
  v_code := public.client_referral_code('00000000-0000-0000-0000-0000000000d1');
  assert v_code ~ '^MARCIA[A-Z0-9]{4}$', 'código inesperado: ' || coalesce(v_code, 'nulo');
  assert public.client_referral_code('00000000-0000-0000-0000-0000000000d1') = v_code, 'código mudou';
  select * into v_p from public.referral_code_info('00000000-0000-0000-0000-00000000000a', lower(v_code));
  assert v_p.referrer_first_name = 'Márcia' and v_p.friend_value = 5, 'info do código errada';

  -- prévia: amiga nova ganha 5%
  select * into v_p from public.referral_preview('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '5531944440002', 'amiga@teste.local', v_code);
  assert v_p.kind = 'friend' and v_p.discount_cents = 400, format('prévia amiga: %s', row_to_json(v_p));

  -- amiga nova agenda com o código: 5% de desconto e indicação registrada
  select * into v_r from public.create_online_booking_v4('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
     (v_day + time '09:00') at time zone 'America/Sao_Paulo', 'Amiga Nova', '5531944440002', 'amiga@teste.local', false, null, 'hash-amiga',
     null, null, v_code);
  select * into v_a from public.appointments where id = v_r.appointment_id;
  assert v_a.price_cents = 7600 and v_a.referral_discount_cents = 400, format('desconto da amiga: %s/%s', v_a.price_cents, v_a.referral_discount_cents);
  select id into v_friend from public.clients where phone = '5531944440002';
  assert (select referred_by_client_id from public.clients where id = v_friend) = '00000000-0000-0000-0000-0000000000d1', 'quem indicou não salvo';
  assert (select status from public.referrals where referred_client_id = v_friend) = 'pending', 'indicação não registrada';

  -- cliente que já existia não vira indicada (nem ganha desconto de amiga)
  select * into v_r from public.create_online_booking_v4('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
     (v_day + time '13:00') at time zone 'America/Sao_Paulo', 'Cliente Antiga', '5531911110001', null, false, null, 'hash-antiga',
     null, null, v_code);
  assert (select referral_discount_cents from public.appointments where id = v_r.appointment_id) = 0, 'cliente antiga ganhou desconto de amiga';
  assert not exists (select 1 from public.referrals r join public.clients c on c.id = r.referred_client_id where c.phone = '5531911110001'), 'cliente antiga virou indicada';

  -- antes do comparecimento, quem indicou ainda não tem desconto
  assert not exists (select 1 from public.referral_rewards where client_id = '00000000-0000-0000-0000-0000000000d1'), 'desconto antes do comparecimento';
  -- amiga compareceu: indicação qualificada e desconto de 10% para a Márcia
  update public.appointments set status = 'completed' where manage_token_hash = 'hash-amiga';
  assert (select status from public.referrals where referred_client_id = v_friend) = 'qualified', 'indicação não qualificada';
  select * into v_rw from public.referral_rewards where client_id = '00000000-0000-0000-0000-0000000000d1';
  assert v_rw.status = 'available' and v_rw.discount_value = 10, 'desconto não criado';

  -- prévia para a Márcia exige WhatsApp E e-mail do cadastro
  select * into v_p from public.referral_preview('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '5531944440001', 'outro@teste.local');
  assert v_p is null or v_p.kind is null, 'prévia revelou desconto sem o e-mail certo';
  select * into v_p from public.referral_preview('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', '5531944440001', 'INDICADORA@teste.local');
  assert v_p.kind = 'reward' and v_p.discount_cents = 800, format('prévia desconto: %s', row_to_json(v_p));

  -- próximo agendamento da Márcia usa o desconto automaticamente
  select * into v_r from public.create_online_booking_v4('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1',
     (v_day + time '15:00') at time zone 'America/Sao_Paulo', 'Márcia Indicadora', '5531944440001', 'indicadora@teste.local', false, null, 'hash-marcia');
  select * into v_a from public.appointments where id = v_r.appointment_id;
  assert v_a.price_cents = 7200 and v_a.referral_discount_cents = 800 and v_a.referral_reward_id = v_rw.id, format('desconto não aplicado: %s', v_a.price_cents);
  assert (select status from public.referral_rewards where id = v_rw.id) = 'used', 'desconto não marcado como usado';

  -- cancelou: desconto volta
  perform public.cancel_booking_by_token('hash-marcia', null);
  assert (select status from public.referral_rewards where id = v_rw.id) = 'available', 'cancelamento não devolveu o desconto';
  raise notice 'OK indicação: código, amiga nova com desconto, só clientes novas, desconto após comparecer, uso automático e devolução ao cancelar';
end $$;

-- ---------- Permissões por área e administrador geral ----------
select set_config('request.jwt.claims', '', true);
update public.business_members set permissions = '{"servicos": false, "legal": false}'
 where user_id = '00000000-0000-0000-0000-0000000000a1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
begin
  assert not public.can_edit('00000000-0000-0000-0000-00000000000a', 'servicos'), 'área bloqueada aparece liberada';
  assert public.can_edit('00000000-0000-0000-0000-00000000000a', 'cupons'), 'área sem regra deveria estar liberada';
  begin
    update public.services set price_cents = 1 where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'FALHOU: editou serviço com a área bloqueada';
  exception when others then assert sqlerrm = 'AREA_BLOQUEADA', sqlerrm; end;
  begin
    update public.businesses set privacy_policy = 'x' where id = '00000000-0000-0000-0000-00000000000a';
    raise exception 'FALHOU: editou texto legal bloqueado';
  exception when others then assert sqlerrm = 'AREA_BLOQUEADA', sqlerrm; end;
  update public.businesses set hero_title = 'Título liberado' where id = '00000000-0000-0000-0000-00000000000a';
  begin
    update public.business_members set permissions = '{}' where user_id = '00000000-0000-0000-0000-0000000000a1';
    raise exception 'FALHOU: proprietária alterou as próprias permissões';
  exception when others then assert sqlerrm = 'SEM_PERMISSAO', sqlerrm; end;
  raise notice 'OK permissões: área bloqueada recusada no banco, área livre aceita, proprietária não altera permissões';
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-0000000000a1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
begin
  update public.services set price_cents = 8100 where id = '00000000-0000-0000-0000-0000000000c1';
  update public.business_members set permissions = '{}' where user_id = '00000000-0000-0000-0000-0000000000a1';
  raise notice 'OK administrador geral edita qualquer área e gerencia permissões';
end $$;
reset role;

-- Auditoria registrou alterações críticas
do $$
begin
  assert (select count(*) from public.audit_logs where entity = 'appointments') >= 3, 'auditoria não registrou';
  raise notice 'OK auditoria de agendamentos registrada';
end $$;

rollback;
