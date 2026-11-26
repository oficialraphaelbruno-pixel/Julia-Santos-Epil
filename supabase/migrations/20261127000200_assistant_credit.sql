-- =====================================================================
-- Crédito da OpenAI no painel da assistente.
-- A OpenAI não oferece uma API oficial com o saldo da carteira; então:
--  * a dona informa o crédito colocado e a data da recarga;
--  * o site registra o consumo de cada mensagem (tokens) por dia;
--  * saldo estimado = crédito − gasto desde a recarga (ou o gasto real,
--    quando há chave de administrador da OpenAI configurada na Vercel).
-- =====================================================================

alter table public.assistant_settings
  add column credit_usd numeric(10, 2) check (credit_usd is null or credit_usd between 0 and 100000),
  add column credit_since date,
  add column low_balance_usd numeric(10, 2) not null default 2 check (low_balance_usd between 0 and 10000),
  add column price_input_per_m numeric(10, 4) not null default 0.15 check (price_input_per_m between 0 and 1000),
  add column price_output_per_m numeric(10, 4) not null default 0.60 check (price_output_per_m between 0 and 1000);

-- Consumo diário (não é apagado junto com as perguntas, que ficam só 90 dias)
create table public.assistant_usage_daily (
  business_id uuid not null references public.businesses (id) on delete cascade,
  day date not null,
  messages integer not null default 0,
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  primary key (business_id, day)
);
alter table public.assistant_usage_daily enable row level security;
revoke all on public.assistant_usage_daily from anon;
create policy "membros leem consumo da assistente" on public.assistant_usage_daily
  for select to authenticated using (public.is_member(business_id));

create or replace function public.record_assistant_usage(p_business_id uuid, p_day date, p_prompt integer, p_completion integer)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.assistant_usage_daily (business_id, day, messages, prompt_tokens, completion_tokens)
  values (p_business_id, p_day, 1, greatest(coalesce(p_prompt, 0), 0), greatest(coalesce(p_completion, 0), 0))
  on conflict (business_id, day) do update
     set messages = public.assistant_usage_daily.messages + 1,
         prompt_tokens = public.assistant_usage_daily.prompt_tokens + excluded.prompt_tokens,
         completion_tokens = public.assistant_usage_daily.completion_tokens + excluded.completion_tokens;
$$;
revoke execute on function public.record_assistant_usage(uuid, date, integer, integer) from public, anon, authenticated;
grant execute on function public.record_assistant_usage(uuid, date, integer, integer) to service_role;
