-- Visão de clientes com indicadores (respeita o RLS de quem consulta).
create or replace view public.client_overview with (security_invoker = true) as
select
  c.*,
  (select max(a.starts_at) from public.appointments a
    where a.client_id = c.id and a.status = 'completed') as last_visit,
  (select min(a.starts_at) from public.appointments a
    where a.client_id = c.id and a.status in ('pending', 'confirmed') and a.starts_at > now()) as next_appointment,
  (select count(*) from public.appointments a
    where a.client_id = c.id and a.status = 'completed')::int as completed_count,
  (select coalesce(sum(a.price_cents), 0) from public.appointments a
    where a.client_id = c.id and a.status = 'completed')::int as total_spent_cents
from public.clients c;

revoke all on public.client_overview from anon;
grant select on public.client_overview to authenticated;
