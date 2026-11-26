-- =====================================================================
-- Link de indicação com o nome da cliente: /indicacao/gabriela
-- Se o nome já estiver em uso no studio: gabriela2, gabriela3, ...
-- Códigos já gerados continuam valendo (não são alterados).
-- =====================================================================

alter table public.clients drop constraint clients_referral_code_check;
alter table public.clients
  add constraint clients_referral_code_check check (referral_code is null or referral_code ~ '^[A-Z0-9]{3,20}$');

create or replace function public.client_referral_code(p_client_id uuid)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_client public.clients%rowtype;
  v_base text; v_code text; v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; n int := 1;
begin
  select * into v_client from public.clients c where c.id = p_client_id;
  if not found then return null; end if;
  if coalesce(auth.role(), '') = 'authenticated' and not public.is_member(v_client.business_id) then return null; end if;
  if v_client.phone like '00%' then return null; end if; -- dados apagados (LGPD)
  if v_client.referral_code is not null then return v_client.referral_code; end if;

  v_base := upper(translate(split_part(trim(v_client.full_name), ' ', 1),
            'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'));
  v_base := left(regexp_replace(v_base, '[^A-Z]', '', 'g'), 16);
  if length(v_base) < 2 then v_base := 'AMIGA'; end if;

  -- nome puro (se tiver 3+ letras), depois nome2, nome3 ... nome99, por fim nome + 4 caracteres aleatórios
  loop
    if n = 1 then
      v_code := case when length(v_base) >= 3 then v_base else v_base || '1' end;
    elsif n <= 99 then
      v_code := v_base || n::text;
    else
      v_code := left(v_base, 12);
      for i in 1..4 loop
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
      end loop;
    end if;
    begin
      update public.clients set referral_code = v_code where id = p_client_id and referral_code is null;
      exit;
    exception when unique_violation then
      n := n + 1;
      if n > 120 then raise; end if;
    end;
  end loop;
  return (select c.referral_code from public.clients c where c.id = p_client_id);
end;
$$;
