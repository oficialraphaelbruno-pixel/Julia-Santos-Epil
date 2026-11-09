# Domínio próprio — passo a passo (Registro.br + Vercel)

Endereço atual (continua funcionando): https://julia-santos-epil.vercel.app

## 1. Comprar no Registro.br (você)
1. Acesse https://registro.br e pesquise o domínio (ex.: `juliasantosepil.com.br`).
2. Faça login com sua conta do Registro.br (CPF ou CNPJ do titular). Sugestão: registrar no CPF/CNPJ da Julia, que é a dona do negócio.
3. Pague (cerca de R$ 40/ano; planos de vários anos têm desconto). Ative a **renovação automática** para não perder o domínio.
4. Ao concluir, **não altere os "servidores DNS"**: mantenha os do próprio Registro.br.
5. Me avise o domínio comprado.

## 2. Ligar o domínio ao site (eu faço)
- Adiciono `juliasantosepil.com.br` e `www.juliasantosepil.com.br` ao projeto na Vercel (o "www" redireciona para o principal).
- Te envio os 2 registros DNS exatos.

## 3. Cadastrar o DNS no Registro.br (você, ~5 minutos)
No painel do Registro.br → clique no domínio → **DNS** → **Editar zona** (ou "Configurar zona DNS") e adicione os registros que eu enviar. Normalmente:

| Tipo | Nome | Valor |
|---|---|---|
| A | (deixe em branco / @) | IP indicado pela Vercel |
| CNAME | www | endereço indicado pela Vercel (termina em `vercel-dns.com`) |

Salve. A ativação costuma levar de minutos a algumas horas. O certificado HTTPS (cadeado) é emitido automaticamente pela Vercel.

## 4. Finalização (eu + você)
- Eu atualizo o endereço do site no sistema (links de e-mail, Pix, “gerenciar agendamento”) e confirmo que tudo abre no domínio novo.
- Você atualiza no Supabase (Authentication → URL Configuration):
  - **Site URL:** `https://juliasantosepil.com.br`
  - **Redirect URLs:** `https://juliasantosepil.com.br/auth/confirm` (pode manter também o endereço `vercel.app`).
- Troque o link na bio do Instagram para `https://juliasantosepil.com.br/agendar/julia-santos-epil`.

## Extra (opcional, depois)
- **E-mail com o domínio** (ex.: `agendamentos@juliasantosepil.com.br`) para os e-mails automáticos: o provedor de envio (Resend/Brevo) pede alguns registros DNS a mais (SPF/DKIM). Eu passo quando for configurar.
