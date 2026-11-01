-- Etapa 1a: novos papéis. Fica em arquivo separado porque valores novos de enum
-- não podem ser usados na mesma transação em que são criados.

alter type public.member_role add value if not exists 'agency';
alter type public.member_role add value if not exists 'tech_admin';
