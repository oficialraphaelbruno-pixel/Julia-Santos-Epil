-- Endurecimento: no Supabase hospedado, funções novas recebem EXECUTE para
-- anon/authenticated por padrão. Revogamos tudo e liberamos só o necessário.
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Usadas pelas políticas RLS (avaliadas com o papel de quem consulta)
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

-- Funções do painel (validam a empresa internamente)
grant execute on function public.admin_dashboard(uuid) to authenticated;
grant execute on function public.admin_save_appointment(uuid, uuid, uuid, uuid, uuid, timestamptz, public.appointment_status, integer, text, boolean) to authenticated;
grant execute on function public.admin_set_appointment_status(uuid, public.appointment_status, text) to authenticated;
grant execute on function public.appointment_history(uuid) to authenticated;
grant execute on function public.get_available_slots(uuid, uuid, date, uuid, boolean) to authenticated;

-- Servidor (chave secreta)
grant execute on all functions in schema public to service_role;

-- rate_limits e tokens do Google: somente o servidor
revoke all on public.rate_limits from anon, authenticated;
