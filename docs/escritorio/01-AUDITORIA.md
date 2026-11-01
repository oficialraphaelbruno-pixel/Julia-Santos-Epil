# Auditoria técnica — Julia Santos Epil | Studio Manager

Data: 01/11/2026 · Commit auditado: `a67f447` (branch `main`) · Realização: RB Assessoria & Comunicação

Fontes verificadas (somente leitura, nada foi alterado):
- Código: repositório `oficialraphaelbruno-pixel/Julia-Santos-Epil` (126 arquivos em `src/`).
- Hospedagem: projeto Vercel `julia-santos-epil` (time `rapha16`), último deploy de produção `READY`.
- Banco: projeto Supabase `chbbmbhlyaqfxfdzkyjj` — tabelas, RLS e alertas de segurança (advisors).

## 1. Tecnologias

| Item | Encontrado |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, `src/proxy.ts`) |
| Linguagem | TypeScript 6, React 19 |
| UI | Tailwind CSS 4, Radix UI, lucide-react, sonner; fontes Playfair Display + DM Sans |
| Formulários/validação | react-hook-form + zod 4 |
| Banco | Supabase (PostgreSQL) com RLS em todas as tabelas |
| Autenticação | Supabase Auth (e-mail/senha), recuperação de senha, MFA TOTP opcional |
| E-mail | nodemailer (SMTP) |
| Testes | vitest (unitários), testes SQL (`supabase/tests`), e2e com Playwright (somente local) |
| Hospedagem | Vercel, região `gru1` (São Paulo), Node 22, 1 cron diário (`/api/cron/lembretes`, 12:00 UTC) |

## 2. Estrutura de diretórios

```
src/app/                 páginas públicas: /, /agendar/[slug], /agendamento/[token], /privacidade, /termos
src/app/admin/(painel)/  painel: agenda, clientes, servicos, horarios, agendamento-online, comunicacao, integracoes, configuracoes
src/app/admin/actions/   Server Actions (todas chamam assertAdmin())
src/app/api/             cron/lembretes, integracoes/google (OAuth), agendamento/[token]/ics
src/components/          admin/, booking/, site/, ui/
src/lib/                 auth, availability, pix, email, google-calendar, whatsapp-cloud, rate-limit, crypto...
supabase/migrations/     8 migrações (esquema, RLS, funções de agenda, seed, integrações, sinal Pix)
tests/                   unit/ e e2e/
```

## 3. Banco de dados (produção — 20 tabelas)

`businesses`, `booking_settings`, `profiles`, `business_members`, `professionals`, `working_hours`, `special_days`, `time_blocks`, `service_categories`, `services`, `service_combo_items`, `clients`, `appointments`, `payments`, `audit_logs`, `rate_limits`, `google_calendar_connections`, `appointment_external_events`, `sync_logs`, `notification_settings`, `message_logs` (+ view `client_overview`).

Volume atual: 1 empresa, 1 serviço, 4 clientes, 5 agendamentos, 0 pagamentos, 18 registros de auditoria.

Pontos fortes do modelo:
- Multiempresa por `business_id` com chaves estrangeiras compostas (impede misturar dados entre empresas).
- Conflito de horários impedido no próprio banco (`occupied tstzrange`).
- Valores em centavos (`price_cents`, `amount_cents`) — correto para finanças.
- Consentimento de marketing já existe em `clients` (`marketing_consent`, `marketing_consent_at`) — base para WhatsApp/LGPD.
- `message_logs.dedupe_key` já evita envio duplicado.

## 4. Autenticação e permissões

- `src/proxy.ts`: primeira barreira em `/admin/*` (redireciona para login). Cabeçalhos `noindex` e `no-store`.
- `src/lib/auth.ts`: `requireAdmin()` (páginas) e `assertAdmin()` (ações) verificam no servidor sessão, MFA e vínculo com a empresa.
- Papéis existentes: apenas `owner` e `staff` (enum `member_role`). Há também `profiles.is_platform_admin`.
- Usuários cadastrados: 2 membros.
- **Lacuna:** não existem os perfis pedidos (Gestão da Agência RB, Administrador Técnico, Colaboradores com permissões por recurso).

## 5. Funcionalidades existentes (reaproveitáveis)

Agenda (dia/semana/mês), agendamento online em 6 etapas, cancelamento/reagendamento por link, clientes com histórico e anonimização LGPD, serviços e categorias, horários/bloqueios/feriados, sinal via Pix (QR + copia e cola, confirmação manual), lançamento manual de pagamentos, exportação CSV, painel com indicadores, e-mails transacionais, lembretes, modelos de mensagem editáveis, WhatsApp manual (links wa.me), integração Google Agenda (OAuth), PWA.

## 6. Integrações — estado real em produção

Variáveis configuradas na Vercel (produção): apenas `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_DEFAULT_BUSINESS_SLUG`, `NEXT_PUBLIC_SITE_URL`.

| Integração | Código | Produção |
|---|---|---|
| Google Agenda | Implementado e testado com simulação | **Bloqueado por credenciais** (sem `GOOGLE_CLIENT_ID/SECRET`) |
| E-mail SMTP | Implementado | **Bloqueado por credenciais** (sem `SMTP_*`) |
| Lembretes automáticos (cron) | Implementado | **Inativo**: sem `CRON_SECRET`, a rota responde 401 todos os dias |
| WhatsApp Cloud API | Só envio de template (`sendWhatsappTemplate`) | **Bloqueado por credenciais**; não há webhook de recebimento |
| Meta Ads, Google Sheets, Canva, IA | Inexistente | — |

## 7. Vulnerabilidades e problemas técnicos

| # | Gravidade | Achado | Recomendação |
|---|---|---|---|
| 1 | Média | Proteção contra senhas vazadas desativada no Supabase Auth | Ativar em Auth > Password security |
| 2 | Média | Não há ambiente de teste: o único banco Supabase é o de produção | Criar banco de desenvolvimento (Supabase local via Docker ou branch) antes de qualquer migração |
| 3 | Média | Cron de lembretes falha diariamente (sem `CRON_SECRET`) | Configurar o segredo ou desativar o cron até haver SMTP |
| 4 | Baixa | 8 funções `SECURITY DEFINER` executáveis por usuários logados | Revisado: todas validam `is_member()` internamente. Aceitável; documentar |
| 5 | Baixa | `google_calendar_connections` e `rate_limits` com RLS e sem políticas | Intencional (acesso só pelo servidor). Aceitável |
| 6 | Baixa | `payments` vazio apesar de agendamentos existentes | Verificar com a Julia se pagamentos estão sendo lançados; impacta o Financeiro |
| 7 | Info | Projeto local deste computador não tem Git nem Node.js | Instalar para desenvolver, testar e versionar |
| 8 | Info | Foto enviada (`2.webp`) tem marca d'água de imagem gerada por IA | Não usar como foto real da Julia sem confirmação |

## 8. Conclusão

O sistema atual é sólido e deve ser **ampliado, não reconstruído**. A base (Next.js + Supabase + RLS + auditoria) comporta o Escritório de Inteligência como novas rotas em `/admin/escritorio/*`, novas tabelas com o mesmo padrão `business_id` + RLS, e novos papéis de acesso.
