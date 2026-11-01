-- Escritório de Inteligência — etapa 1b: permissões por recurso, tarefas, aprovações,
-- execuções de agentes, Central de T.I. e ativação de funcionalidades.
-- Somente adições: nenhuma tabela ou coluna existente é alterada.

-- ---------------------------------------------------------------------
-- Permissões por recurso
-- Ligadas ao vínculo com a empresa: removida da equipe => perde as permissões.
-- ---------------------------------------------------------------------
create table public.member_permissions (
  business_id uuid not null,
  user_id uuid not null,
  permission text not null check (permission ~ '^[a-z_]+(\.[a-z_]+)+$'),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (business_id, user_id, permission),
  foreign key (business_id, user_id) references public.business_members (business_id, user_id) on delete cascade
);
create index member_permissions_user_idx on public.member_permissions (user_id);

-- Proprietária tem tudo. Demais papéis: permissões explícitas.
-- Uma permissão cobre as filhas: 'escritorio.financeiro' cobre 'escritorio.financeiro.ver'.
create or replace function public.has_permission(p_business_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_owner(p_business_id) or exists (
    select 1 from public.member_permissions mp
    where mp.business_id = p_business_id
      and mp.user_id = (select auth.uid())
      and (mp.permission = p_permission or starts_with(p_permission, mp.permission || '.'))
  );
$$;

alter table public.member_permissions enable row level security;
create policy "membros veem permissoes" on public.member_permissions
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria gerencia permissoes" on public.member_permissions
  for all to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));

-- ---------------------------------------------------------------------
-- Central de tarefas
-- ---------------------------------------------------------------------
create type public.office_agent as enum (
  'diretor_executivo', 'ti', 'marketing', 'trafego', 'financeiro', 'whatsapp_crm',
  'copywriter', 'comercial', 'fidelizacao', 'operacoes', 'dados'
);
create type public.task_status as enum ('nova', 'em_analise', 'aguardando_aprovacao', 'em_execucao', 'concluida', 'cancelada', 'bloqueada');
create type public.task_priority as enum ('baixa', 'media', 'alta', 'urgente');

create sequence public.office_task_code_seq;

create table public.office_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  code text not null,                         -- T-0001 (gerado automaticamente)
  requested_by uuid references auth.users (id) on delete set null,
  agent public.office_agent not null,
  category text not null check (length(category) between 2 and 60),
  title text not null check (length(title) between 3 and 160),
  description text not null check (length(description) <= 10000),
  priority public.task_priority not null default 'media',
  status public.task_status not null default 'nova',
  result text,
  parent_id uuid references public.office_tasks (id) on delete set null,
  campaign_id uuid,                           -- FK adicionada na etapa de campanhas
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);
create index office_tasks_business_status_idx on public.office_tasks (business_id, status, created_at desc);
create trigger office_tasks_updated_at before update on public.office_tasks
  for each row execute function public.set_updated_at();

create or replace function public.office_tasks_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.code := 'T-' || lpad(nextval('public.office_task_code_seq')::text, 4, '0');
  else
    -- campos de origem não mudam depois de criados
    new.code := old.code;
    new.business_id := old.business_id;
    new.requested_by := old.requested_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
create trigger office_tasks_defaults before insert or update on public.office_tasks
  for each row execute function public.office_tasks_defaults();

create table public.office_task_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  task_id uuid not null references public.office_tasks (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_label text,                           -- ex.: 'agente:financeiro'
  kind text not null check (kind in ('criada', 'status', 'comentario', 'resultado', 'anexo', 'delegada')),
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index office_task_events_task_idx on public.office_task_events (task_id, created_at);

-- ---------------------------------------------------------------------
-- Central de aprovações (nenhuma ação externa sem registro aprovado)
-- ---------------------------------------------------------------------
create type public.approval_kind as enum (
  'campanha', 'publicacao', 'envio_mensagens', 'alteracao_anuncio', 'mudanca_preco',
  'mudanca_critica_sistema', 'impacto_financeiro'
);
create type public.approval_status as enum ('pendente', 'aprovada', 'rejeitada', 'expirada', 'executada', 'falhou');

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind public.approval_kind not null,
  title text not null check (length(title) between 3 and 160),
  summary text not null,
  payload jsonb not null,                     -- exatamente o que será executado
  payload_hash text not null,                 -- sha256 do payload, conferido na execução
  estimated_cost_cents integer check (estimated_cost_cents >= 0),
  task_id uuid references public.office_tasks (id) on delete set null,
  requested_by uuid references auth.users (id) on delete set null,
  requested_by_agent public.office_agent,
  status public.approval_status not null default 'pendente',
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  executed_at timestamptz,
  execution_result jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  -- toda aprovação decidida registra quem e quando decidiu
  check (status in ('pendente', 'expirada') or (decided_by is not null and decided_at is not null))
);
create index approvals_business_status_idx on public.approvals (business_id, status, created_at desc);

-- Regras de transição:
--   pendente -> aprovada | rejeitada (usuária, com permissão) | expirada
--   aprovada -> executada | falhou (somente o servidor)
-- Conteúdo, solicitante e decisão nunca mudam depois de gravados.
create or replace function public.guard_approval_update()
returns trigger language plpgsql set search_path = '' as $$
declare v_server boolean := coalesce(auth.role(), '') not in ('authenticated', 'anon');
begin
  if new.payload is distinct from old.payload or new.payload_hash is distinct from old.payload_hash
     or new.kind is distinct from old.kind or new.business_id is distinct from old.business_id
     or new.requested_by is distinct from old.requested_by or new.created_at is distinct from old.created_at then
    raise exception 'O conteúdo de uma aprovação não pode ser alterado.' using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    if new.decided_by is distinct from old.decided_by or new.decided_at is distinct from old.decided_at then
      raise exception 'A decisão não pode ser alterada.' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status = 'pendente' and new.status in ('aprovada', 'rejeitada') then
    if v_server then
      raise exception 'Aprovações só podem ser decididas por uma pessoa.' using errcode = '42501';
    end if;
    new.decided_by := (select auth.uid());
    new.decided_at := now();
    if new.decided_by = old.requested_by and not public.is_owner(old.business_id) then
      raise exception 'Quem solicitou não pode aprovar o próprio pedido.' using errcode = '42501';
    end if;
  elsif old.status = 'pendente' and new.status = 'expirada' then
    null;
  elsif old.status = 'aprovada' and new.status in ('executada', 'falhou') and v_server then
    new.executed_at := coalesce(new.executed_at, now());
  else
    raise exception 'Transição de status não permitida: % -> %', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger approvals_guard before update on public.approvals
  for each row execute function public.guard_approval_update();

-- ---------------------------------------------------------------------
-- Execuções de agentes de IA (custo e auditoria) — gravadas só pelo servidor
-- ---------------------------------------------------------------------
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  agent public.office_agent not null,
  task_id uuid references public.office_tasks (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_estimate_micros bigint not null default 0,   -- USD * 1e6
  status text not null check (status in ('ok', 'erro', 'bloqueado_orcamento')),
  error text,
  created_at timestamptz not null default now()
);
create index agent_runs_business_month_idx on public.agent_runs (business_id, created_at);

-- ---------------------------------------------------------------------
-- Central de T.I.
-- ---------------------------------------------------------------------
create type public.it_risk as enum ('baixo', 'medio', 'alto', 'critico');

create table public.it_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  task_id uuid not null unique references public.office_tasks (id) on delete cascade,
  kind text not null check (kind in ('configuracao', 'codigo')),  -- configuracao = painel; codigo = Claude Code
  risk public.it_risk,
  feasibility text,
  affected_areas text[],
  plan text,
  branch text,
  preview_url text,
  tests_summary text,
  approval_id uuid references public.approvals (id) on delete set null,
  deployed_at timestamptz,
  rollback_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger it_requests_updated_at before update on public.it_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Ativação de funcionalidades
-- ---------------------------------------------------------------------
create table public.feature_flags (
  business_id uuid not null references public.businesses (id) on delete cascade,
  key text not null check (key ~ '^[a-z_.]+$'),
  enabled boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (business_id, key)
);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.office_tasks enable row level security;
alter table public.office_task_events enable row level security;
alter table public.approvals enable row level security;
alter table public.agent_runs enable row level security;
alter table public.it_requests enable row level security;
alter table public.feature_flags enable row level security;

create policy "le tarefas" on public.office_tasks for select to authenticated
  using (public.has_permission(business_id, 'escritorio.tarefas.ver'));
create policy "cria tarefas" on public.office_tasks for insert to authenticated
  with check (public.has_permission(business_id, 'escritorio.tarefas.criar') and requested_by = (select auth.uid()));
create policy "atualiza tarefas" on public.office_tasks for update to authenticated
  using (public.has_permission(business_id, 'escritorio.tarefas.editar'))
  with check (public.has_permission(business_id, 'escritorio.tarefas.editar'));

create policy "le historico de tarefas" on public.office_task_events for select to authenticated
  using (public.has_permission(business_id, 'escritorio.tarefas.ver'));
create policy "registra historico" on public.office_task_events for insert to authenticated
  with check (public.has_permission(business_id, 'escritorio.tarefas.ver') and actor_id = (select auth.uid()));

create policy "le aprovacoes" on public.approvals for select to authenticated
  using (public.has_permission(business_id, 'escritorio.aprovacoes.ver'));
create policy "solicita aprovacao" on public.approvals for insert to authenticated
  with check (public.has_permission(business_id, 'escritorio.aprovacoes.solicitar')
              and requested_by = (select auth.uid()) and status = 'pendente'
              and decided_by is null and decided_at is null);
create policy "decide aprovacao" on public.approvals for update to authenticated
  using (public.has_permission(business_id, 'escritorio.aprovacoes.decidir'))
  with check (public.has_permission(business_id, 'escritorio.aprovacoes.decidir'));

create policy "le execucoes de agentes" on public.agent_runs for select to authenticated
  using (public.has_permission(business_id, 'escritorio.agentes.ver'));

create policy "le central de ti" on public.it_requests for select to authenticated
  using (public.has_permission(business_id, 'escritorio.ti.ver'));
create policy "gerencia central de ti" on public.it_requests for all to authenticated
  using (public.has_permission(business_id, 'escritorio.ti.gerenciar'))
  with check (public.has_permission(business_id, 'escritorio.ti.gerenciar'));

create policy "membros leem flags" on public.feature_flags for select to authenticated
  using (public.is_member(business_id));
create policy "proprietaria altera flags" on public.feature_flags for all to authenticated
  using (public.is_owner(business_id)) with check (public.is_owner(business_id));

revoke all on public.office_tasks, public.office_task_events, public.approvals, public.agent_runs,
              public.it_requests, public.feature_flags, public.member_permissions from anon;
revoke all on sequence public.office_task_code_seq from anon, authenticated;
revoke delete on public.office_tasks, public.office_task_events, public.approvals from authenticated;
revoke update on public.office_task_events from authenticated;
revoke insert, update, delete on public.agent_runs from authenticated;

-- No Supabase hospedado funções novas nascem executáveis por anon: revogar explicitamente.
revoke execute on function public.has_permission(uuid, text) from public, anon;
grant execute on function public.has_permission(uuid, text) to authenticated;
revoke execute on function public.office_tasks_defaults() from public, anon, authenticated;
revoke execute on function public.guard_approval_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Auditoria (reaproveita a função existente)
-- member_permissions e feature_flags não têm coluna id: entity_id fica nulo
-- (mesmo caso de booking_settings); os detalhes trazem a linha completa.
-- ---------------------------------------------------------------------
create trigger audit_member_permissions after insert or update or delete on public.member_permissions
  for each row execute function public.audit_row_change();
create trigger audit_approvals after insert or update on public.approvals
  for each row execute function public.audit_row_change();
create trigger audit_feature_flags after insert or update or delete on public.feature_flags
  for each row execute function public.audit_row_change();
