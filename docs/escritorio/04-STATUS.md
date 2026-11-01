# Status das funcionalidades

Classificação: **Planejada · Em desenvolvimento · Implementada · Testada · Conectada · Em produção · Bloqueada** (motivo).
Interface sem lógica real nunca conta como "Implementada".

Atualizado em 01/11/2026.

## Sistema existente (Studio Manager)

| Funcionalidade | Status |
|---|---|
| Site público, agendamento online, gestão por link | Em produção |
| Agenda, clientes, serviços, horários, bloqueios | Em produção |
| Sinal via Pix (confirmação manual) | Em produção |
| Login, recuperação de senha, MFA | Em produção |
| E-mails transacionais e lembretes | Implementada · **Bloqueada** (sem SMTP e `CRON_SECRET` em produção) |
| Google Agenda | Testada (simulação) · **Bloqueada** (sem credenciais OAuth) |
| WhatsApp Cloud API (envio de templates) | Implementada · **Bloqueada** (sem credenciais) |

## Escritório de Inteligência

| # | Entrega | Status |
|---|---|---|
| 1 | Arquitetura técnica (`02-ARQUITETURA.md`) | Implementada (documento) |
| 2 | `CLAUDE.md` | Implementada |
| 3 | Subagentes (11 em `.claude/agents/`) | Implementada · não testada em uso real |
| 4 | Skills (7 em `.claude/skills/`) | Implementada · não testada em uso real |
| 5 | Estrutura modular (rotas `/admin/escritorio/*`) | Planejada |
| 6 | Documentação de integrações (`05-INTEGRACOES.md`) | Implementada (documento) |
| 7 | Esquema do banco (`03-BANCO-DE-DADOS.md`) | Implementada (documento) |
| 8 | Migrações | Etapa 1 **Testada** no banco dev (16/16 testes); não aplicada em produção |
| 9 | Dashboard administrativo do escritório | Planejada |
| 10 | Sistema de permissões (papéis + por recurso) | Banco: **Testada** no dev · Interface/servidor: Planejada |
| 11 | Central de T.I. | Planejada |
| 12 | Laboratório de Marketing | Planejada · IA **bloqueada** (sem `ANTHROPIC_API_KEY`/orçamento) |
| 13 | Central de Campanhas | Planejada |
| 14 | Central de WhatsApp | Planejada · **Bloqueada** (credenciais Meta + webhook) |
| 15 | Dashboard Financeiro | Planejada |
| 16 | Integração Google Sheets | Planejada · **Bloqueada** (conta de serviço) |
| 17 | Painel Meta Ads | Planejada · **Bloqueada** (app Meta + permissão `ads_read`) |
| 18 | Central de Aprovações | Banco: **Testada** no dev (imutabilidade, autoria, transições) · Interface: Planejada |
| 19 | Testes | Planejada |
| 20 | Documentação de operação e manutenção | Planejada |
| — | Logomarca RB em `public/brand/rb-assessoria-logo.png` | Implementada (arquivo adicionado) |
| — | Testes SQL do escritório (`supabase/tests/escritorio_permissions.test.sql`) | Testada (16/16 no dev) |
| — | Créditos institucionais RB no painel | Planejada |

## Ambientes
| Ambiente | Onde | Situação |
|---|---|---|
| Desenvolvimento local | Git 2.56 + Node.js 26 LTS, branch `escritorio/base` | typecheck ✓ · lint ✓ (1 aviso antigo) · 25/25 testes unitários ✓ |
| Banco dev | Supabase `julia-santos-epil-dev` (`akrnrwedknyugfbbqguy`, sa-east-1, US$ 0/mês) | Estrutura idêntica à produção + etapa 1 do escritório; sem dados de clientes |
| Produção | Supabase `chbbmbhlyaqfxfdzkyjj` + Vercel `julia-santos-epil` | Inalterada |
