# Guia de implantação (produção)

> Nada aqui foi publicado automaticamente. Nenhum serviço pago foi contratado.

## 1. Hospedagem recomendada
| Item | Recomendação | Custo aproximado |
|---|---|---|
| Aplicação | **Vercel Pro** (o plano Hobby é restrito a uso não comercial — não use para o studio) | US$ 20/mês por membro |
| Alternativa | Netlify Pro, Render, Railway ou Fly.io (verifique os termos comerciais) | variável |
| Banco/Auth/Storage | **Supabase** (plano Free para começar; **Pro** recomendado para backups diários e sem pausa por inatividade) | Free / US$ 25/mês |
| Domínio | `juliasantosepil.com.br` no Registro.br (verifique disponibilidade) | ~R$ 40/ano |

Observação: projetos no plano Free do Supabase são pausados após inatividade prolongada e não incluem backups automáticos diários. Para uso comercial, o Pro é o indicado.

## 2. Supabase (produção)
1. Crie o projeto em https://supabase.com (região: São Paulo `sa-east-1`).
2. Aplique as migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase db push
   ```
3. Em **Authentication > Providers > Email**: desative "Allow new users to sign up" (não há cadastro público).
4. Em **Authentication > URL Configuration**:
   - Site URL: `https://www.juliasantosepil.com.br`
   - Redirect URLs: `https://www.juliasantosepil.com.br/auth/confirm`
5. Em **Authentication > Email Templates > Reset password**, use o link:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/admin/nova-senha`
6. Configure um SMTP próprio (Authentication > SMTP) para e-mails de recuperação confiáveis (o SMTP padrão do Supabase tem limite baixo).
7. Senha mínima: Authentication > Policies → 10 caracteres.

## 3. Vercel
1. Importe o repositório.
2. Variáveis de ambiente (Production):
   - `NEXT_PUBLIC_SITE_URL=https://www.juliasantosepil.com.br`
   - `NEXT_PUBLIC_DEFAULT_BUSINESS_SLUG=julia-santos-epil`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (marcar como sensível)
   - `RATE_LIMIT_SALT` (`openssl rand -hex 32`)
3. Deploy. Depois crie a administradora:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/create-admin.mjs --email EMAIL_DA_JULIA
   ```

## 4. Domínio personalizado
1. Registre o domínio no https://registro.br (verifique disponibilidade; requer CPF/CNPJ).
2. Na Vercel: Settings > Domains > adicione `juliasantosepil.com.br` e `www.juliasantosepil.com.br`.
3. No Registro.br, em DNS, crie os registros indicados pela Vercel (normalmente `A @ 76.76.21.21` e `CNAME www cname.vercel-dns.com`).
4. HTTPS é emitido automaticamente.
5. Atualize `NEXT_PUBLIC_SITE_URL` e as URLs do Supabase.

## 5. Backup e recuperação
- Supabase Pro: backups diários automáticos (7 dias) + opção PITR.
- Complementar: exportação CSV mensal em Configurações > Exportação, e `pg_dump` periódico:
  ```bash
  npx supabase db dump --linked -f backup-$(date +%F).sql --data-only
  ```
- Recuperação: novo projeto → `db push` → restaurar dump com `psql`.
