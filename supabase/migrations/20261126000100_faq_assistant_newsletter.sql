-- =====================================================================
-- FAQ, assistente virtual (Mel) e lista de e-mails para novidades.
-- * faq_items: perguntas e respostas escritas pela dona (as respostas de
--   cuidados, pagamento, cancelamento e endereço são geradas no site a partir
--   dos dados já cadastrados, sem duplicar texto).
-- * assistant_settings: configuração da assistente (começa DESLIGADA).
-- * assistant_logs: texto das perguntas feitas à assistente (sem identificar
--   quem perguntou), para a dona ver o que ela não soube responder. Guardado
--   por até 90 dias.
-- * newsletter_subscribers: e-mails de quem pediu para receber novidades pelo
--   site (fora do agendamento). Gravação só pelo servidor (subscribe_newsletter).
-- Área de permissão: "assistente".
-- =====================================================================

-- ---------------------------------------------------------------------
-- Perguntas frequentes
-- ---------------------------------------------------------------------
create table public.faq_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category text not null check (category in ('pre', 'pos', 'pagamento', 'agendamento', 'outros')),
  question text not null check (length(trim(question)) between 3 and 200),
  answer text not null check (length(trim(answer)) between 1 and 3000),
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index faq_items_business_idx on public.faq_items (business_id, category, sort_order);
create trigger faq_items_updated_at before update on public.faq_items
  for each row execute function public.set_updated_at();
create trigger audit_faq_items after insert or update or delete on public.faq_items
  for each row execute function public.audit_row_change();
create trigger area_assistente before insert or update or delete on public.faq_items
  for each row execute function public.guard_area('assistente');

alter table public.faq_items enable row level security;
revoke all on public.faq_items from anon;
create policy "membros leem faq" on public.faq_items
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria cria faq" on public.faq_items
  for insert to authenticated with check (public.is_owner(business_id));
create policy "proprietaria altera faq" on public.faq_items
  for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));
create policy "proprietaria exclui faq" on public.faq_items
  for delete to authenticated using (public.is_owner(business_id));

-- ---------------------------------------------------------------------
-- Assistente virtual
-- ---------------------------------------------------------------------
create table public.assistant_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  enabled boolean not null default false,
  name text not null default 'Mel' check (length(trim(name)) between 1 and 30),
  welcome_message text not null default
    'Oi, flor! Eu sou a Mel 🍯 Estou aqui para te ajudar com dúvidas sobre os cuidados antes e depois da epilação, pagamento e agendamento. Como posso te ajudar hoje?'
    check (length(welcome_message) between 1 and 600),
  personality text check (personality is null or length(personality) <= 1500),
  extra_info text check (extra_info is null or length(extra_info) <= 4000),
  avoid_topics text check (avoid_topics is null or length(avoid_topics) <= 1500),
  daily_limit integer not null default 300 check (daily_limit between 10 and 5000),
  model text not null default 'gpt-4o-mini' check (model ~ '^[a-zA-Z0-9._:-]{3,60}$'),
  updated_at timestamptz not null default now()
);
insert into public.assistant_settings (business_id) select id from public.businesses on conflict do nothing;
create trigger assistant_settings_updated_at before update on public.assistant_settings
  for each row execute function public.set_updated_at();
create trigger audit_assistant_settings after insert or update or delete on public.assistant_settings
  for each row execute function public.audit_row_change();
create trigger area_assistente before insert or update or delete on public.assistant_settings
  for each row execute function public.guard_area('assistente');

alter table public.assistant_settings enable row level security;
revoke all on public.assistant_settings from anon;
create policy "membros leem assistente" on public.assistant_settings
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria altera assistente" on public.assistant_settings
  for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));

create or replace function public.handle_new_business_assistant()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.assistant_settings (business_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger businesses_assistant_settings after insert on public.businesses
  for each row execute function public.handle_new_business_assistant();

-- Perguntas feitas à assistente (somente texto, sem identificar a visitante)
create table public.assistant_logs (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  question text not null check (length(question) <= 600),
  answered boolean not null default true,
  created_at timestamptz not null default now()
);
create index assistant_logs_business_idx on public.assistant_logs (business_id, created_at desc);
alter table public.assistant_logs enable row level security;
revoke all on public.assistant_logs from anon;
create policy "membros leem perguntas da assistente" on public.assistant_logs
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria apaga perguntas da assistente" on public.assistant_logs
  for delete to authenticated using (public.is_owner(business_id));

-- ---------------------------------------------------------------------
-- Inscritas para receber novidades (fora do agendamento)
-- ---------------------------------------------------------------------
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  source text not null default 'site' check (source in ('site', 'faq', 'assistente')),
  consent_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index newsletter_subscribers_email_idx on public.newsletter_subscribers (business_id, lower(email));
create trigger audit_newsletter_subscribers after insert or update or delete on public.newsletter_subscribers
  for each row execute function public.audit_row_change();

alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon;
create policy "membros leem inscritas" on public.newsletter_subscribers
  for select to authenticated using (public.is_member(business_id));
create policy "proprietaria altera inscritas" on public.newsletter_subscribers
  for update to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));
create policy "proprietaria exclui inscritas" on public.newsletter_subscribers
  for delete to authenticated using (public.is_owner(business_id));

-- Inscrição pelo site (chamada só pelo servidor). Reinscreve quem tinha saído.
create or replace function public.subscribe_newsletter(p_business_id uuid, p_email text, p_source text default 'site')
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'EMAIL_INVALIDO' using errcode = 'P0001';
  end if;
  if p_source not in ('site', 'faq', 'assistente') then p_source := 'site'; end if;
  insert into public.newsletter_subscribers (business_id, email, source)
  values (p_business_id, v_email, p_source)
  on conflict (business_id, lower(email)) do update
     set unsubscribed_at = null,
         consent_at = case when public.newsletter_subscribers.unsubscribed_at is not null then now()
                           else public.newsletter_subscribers.consent_at end;
  return true;
end;
$$;

revoke execute on function public.subscribe_newsletter(uuid, text, text) from public, anon, authenticated;
grant execute on function public.subscribe_newsletter(uuid, text, text) to service_role;
