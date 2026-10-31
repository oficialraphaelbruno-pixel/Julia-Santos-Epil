-- =====================================================================
-- Primeira empresa da plataforma: Julia Santos Epil
-- Somente dados oficiais fornecidos. Endereço, horários, serviços,
-- preços e biografia NÃO são inventados: são cadastrados no painel.
-- =====================================================================
insert into public.businesses (
  slug, name, timezone, currency, plan, billing_exempt,
  whatsapp_phone, instagram_url,
  hero_title, hero_subtitle,
  logo_url, photo_url
) values (
  'julia-santos-epil', 'Julia Santos Epil', 'America/Sao_Paulo', 'BRL', 'premium', true,
  '5531998628886', 'https://www.instagram.com/julia.santos_epil/',
  'Seu momento de cuidado começa aqui.',
  'Agende seu atendimento com praticidade e reserve um momento especial de cuidado para você.',
  '/brand/julia-santos-logo.png', '/brand/julia-santos-foto.webp'
) on conflict (slug) do nothing;

-- Profissional inicial (os 7 dias nascem fechados até a configuração real).
insert into public.professionals (business_id, display_name)
select b.id, 'Julia Santos' from public.businesses b
 where b.slug = 'julia-santos-epil'
   and not exists (select 1 from public.professionals p where p.business_id = b.id);
