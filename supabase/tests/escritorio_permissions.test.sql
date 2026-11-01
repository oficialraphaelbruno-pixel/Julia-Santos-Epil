-- Testes do Escritório de Inteligência: permissões, tarefas e aprovações.
-- Executar: psql "<conexão do banco de DESENVOLVIMENTO>" -v ON_ERROR_STOP=1 -f supabase/tests/escritorio_permissions.test.sql
-- Roda dentro de uma transação e desfaz tudo ao final.
\set ON_ERROR_STOP on
begin;

-- ---------- Preparação ----------
-- a1 = proprietária da empresa A; g1 = agência (RB); s1 = equipe sem permissões; b1 = proprietária da empresa B
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'dona-a@teste.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a2', 'agencia@teste.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a3', 'equipe@teste.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b1', 'dona-b@teste.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

insert into public.businesses (id, slug, name) values
  ('00000000-0000-0000-0000-00000000000a', 'escritorio-teste-a', 'Empresa A'),
  ('00000000-0000-0000-0000-00000000000b', 'escritorio-teste-b', 'Empresa B');
insert into public.business_members (business_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'agency'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'staff'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- Agência: pode ver/criar/editar tarefas e solicitar/decidir aprovações. Nada de financeiro.
insert into public.member_permissions (business_id, user_id, permission) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'escritorio.tarefas'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'escritorio.aprovacoes.solicitar'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'escritorio.aprovacoes.decidir'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'escritorio.aprovacoes.ver');

-- Permissão só pode existir para quem é membro da empresa
do $$ begin
  insert into public.member_permissions (business_id, user_id, permission)
  values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a2', 'escritorio.tarefas');
  raise exception 'FALHOU: permissão aceita para não membro';
exception when foreign_key_violation then
  raise notice 'OK 1: permissão exige vínculo com a empresa';
end $$;

create temp table t_ids (k text primary key, v uuid);
grant all on t_ids to authenticated;

-- ---------- Agência ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

do $$
declare v_id uuid; v_code text;
begin
  assert public.has_permission('00000000-0000-0000-0000-00000000000a', 'escritorio.tarefas.ver'), 'permissão-mãe deveria cobrir a filha';
  assert not public.has_permission('00000000-0000-0000-0000-00000000000a', 'escritorio.tarefasx.ver'), 'prefixo sem ponto não pode cobrir';
  assert not public.has_permission('00000000-0000-0000-0000-00000000000a', 'escritorio.financeiro.ver'), 'agência não tem financeiro';
  assert not public.has_permission('00000000-0000-0000-0000-00000000000b', 'escritorio.tarefas.ver'), 'outra empresa';
  raise notice 'OK 2: has_permission (hierarquia, prefixo, isolamento)';

  insert into public.office_tasks (business_id, requested_by, agent, category, title, description, code)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'marketing', 'campanha',
          'Campanha de novembro', 'Planejar campanha', 'CODIGO-FORJADO')
  returning id, code into v_id, v_code;
  assert v_code ~ '^T-[0-9]{4,}$', format('código não gerado: %s', v_code);
  insert into t_ids values ('task', v_id);
  raise notice 'OK 3: tarefa criada com código %', v_code;

  update public.office_tasks set status = 'em_analise', code = 'X', requested_by = '00000000-0000-0000-0000-0000000000a1' where id = v_id;
  select code into v_code from public.office_tasks where id = v_id;
  assert v_code like 'T-%', 'código não pode ser alterado';
  assert (select requested_by from public.office_tasks where id = v_id) = '00000000-0000-0000-0000-0000000000a2', 'solicitante não pode mudar';
  raise notice 'OK 4: campos de origem protegidos';

  begin
    delete from public.office_tasks where id = v_id;
    raise exception 'FALHOU: tarefa apagada';
  exception when insufficient_privilege then
    raise notice 'OK 5: tarefas não podem ser apagadas';
  end;

  insert into public.approvals (business_id, kind, title, summary, payload, payload_hash, requested_by, task_id)
  values ('00000000-0000-0000-0000-00000000000a', 'campanha', 'Campanha R$ 200', 'Meta Ads 7 dias',
          '{"orcamento_cents":20000}', 'hash', '00000000-0000-0000-0000-0000000000a2', v_id)
  returning id into v_id;
  insert into t_ids values ('approval', v_id);

  begin
    update public.approvals set status = 'aprovada' where id = v_id;
    raise exception 'FALHOU: agência aprovou o próprio pedido';
  exception when insufficient_privilege then
    raise notice 'OK 6: quem solicita não aprova o próprio pedido';
  end;

  begin
    insert into public.approvals (business_id, kind, title, summary, payload, payload_hash, requested_by, status, decided_by, decided_at)
    values ('00000000-0000-0000-0000-00000000000a', 'campanha', 'Forjada', 'x', '{}', 'h',
            '00000000-0000-0000-0000-0000000000a2', 'aprovada', '00000000-0000-0000-0000-0000000000a1', now());
    raise exception 'FALHOU: aprovação criada já aprovada';
  exception when insufficient_privilege then
    raise notice 'OK 7: aprovação não nasce aprovada';
  end;
end $$;

-- ---------- Equipe sem permissões ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.office_tasks) = 0, 'equipe sem permissão não deveria ver tarefas';
  assert (select count(*) from public.approvals) = 0, 'equipe sem permissão não deveria ver aprovações';
  begin
    insert into public.office_tasks (business_id, requested_by, agent, category, title, description)
    values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'ti', 'teste', 'Teste', 'x');
    raise exception 'FALHOU: equipe criou tarefa sem permissão';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 8: equipe sem permissão não vê nem cria';
end $$;

-- ---------- Outra empresa ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.office_tasks) = 0, 'empresa B não pode ver tarefas da A';
  assert (select count(*) from public.approvals) = 0, 'empresa B não pode ver aprovações da A';
  raise notice 'OK 9: isolamento entre empresas';
end $$;

-- ---------- Proprietária decide ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
declare v_id uuid := (select v from t_ids where k = 'approval'); v_row public.approvals%rowtype;
begin
  update public.approvals set status = 'aprovada', decided_by = '00000000-0000-0000-0000-0000000000a2' where id = v_id;
  select * into v_row from public.approvals where id = v_id;
  assert v_row.status = 'aprovada', 'deveria estar aprovada';
  assert v_row.decided_by = '00000000-0000-0000-0000-0000000000a1', 'decisão deve registrar quem realmente aprovou';
  assert v_row.decided_at is not null, 'data da decisão';
  raise notice 'OK 10: proprietária aprova e a autoria não pode ser forjada';

  begin
    update public.approvals set payload = '{"orcamento_cents":99999}' where id = v_id;
    raise exception 'FALHOU: conteúdo alterado após aprovação';
  exception when insufficient_privilege then
    raise notice 'OK 11: conteúdo imutável';
  end;

  begin
    update public.approvals set status = 'pendente' where id = v_id;
    raise exception 'FALHOU: voltou para pendente';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.approvals set status = 'executada' where id = v_id;
    raise exception 'FALHOU: usuária marcou como executada';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK 12: transições inválidas bloqueadas';

  -- Revogar acesso: remover a agência da equipe apaga as permissões
  delete from public.business_members
   where business_id = '00000000-0000-0000-0000-00000000000a' and user_id = '00000000-0000-0000-0000-0000000000a2';
  assert not exists (select 1 from public.member_permissions where user_id = '00000000-0000-0000-0000-0000000000a2'),
    'permissões deveriam ser removidas junto com o vínculo';
  raise notice 'OK 13: revogação de acesso remove permissões';

  assert exists (select 1 from public.audit_logs where entity = 'approvals' and entity_id = v_id and action = 'update'),
    'aprovação deveria gerar auditoria';
  raise notice 'OK 14: auditoria registrada';
end $$;

-- ---------- Servidor executa ----------
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$
declare v_id uuid := (select v from t_ids where k = 'approval');
begin
  update public.approvals set status = 'executada', execution_result = '{"ok":true}' where id = v_id;
  assert (select executed_at from public.approvals where id = v_id) is not null, 'executed_at';
  raise notice 'OK 15: servidor registra execução de item aprovado';
end $$;

-- ---------- Visitante anônimo ----------
set local role anon;
do $$ begin
  begin
    perform 1 from public.office_tasks;
    raise exception 'FALHOU: anon leu tarefas';
  exception when insufficient_privilege then
    raise notice 'OK 16: anon sem acesso';
  end;
end $$;

rollback;
