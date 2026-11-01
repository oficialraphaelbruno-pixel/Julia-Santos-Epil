# Arquitetura — Julia Santos Epil | Business Intelligence Office

Realização: RB Assessoria & Comunicação

## 1. Princípio

Ampliar o Studio Manager existente. O Escritório de Inteligência é uma nova seção do mesmo app Next.js, usando o mesmo Supabase, a mesma autenticação e o mesmo padrão de segurança (`business_id` + RLS + Server Actions com verificação no servidor).

## 2. Dois ambientes (distinção obrigatória)

| | Ambiente A — Claude Code | Ambiente B — Escritório web |
|---|---|---|
| Quem usa | Responsável técnico / RB | Julia, RB, colaboradores autorizados |
| Para quê | Programar, testar, migrar, versionar, preparar deploy | Operar: indicadores, campanhas, tarefas, aprovações, conversas com especialistas |
| Agentes | Subagentes em `.claude/agents/` + skills em `.claude/skills/` | Especialistas servidos por um backend de IA próprio (`/api/escritorio/agentes/*`) |
| Credenciais | Ferramentas locais do desenvolvedor | `ANTHROPIC_API_KEY` só no servidor (Vercel), nunca no navegador |

Os subagentes do Claude Code **não** ficam disponíveis no navegador. Os especialistas do escritório web reutilizam as mesmas definições de função (texto), carregadas pelo backend, mas são executados via API de modelos contratada.

### Limitações do Claude Code (documentadas)
- Subagentes não chamam outros subagentes. A coordenação é feita pela sessão principal, que atua como **Diretor Executivo** (regras em `CLAUDE.md` e skill `coordenar-escritorio`).
- Subagentes devolvem um único relatório à sessão principal; não há conversa direta entre eles. O "trabalho conjunto" acontece pela sessão principal repassando o resultado de um setor como entrada do próximo.

## 3. Módulos do painel (`/admin/escritorio/*`)

| Rota | Módulo | Depende de |
|---|---|---|
| `/admin/escritorio` | Visão geral (resumo, alertas, aprovações pendentes, atividades) | Banco atual |
| `/admin/escritorio/agentes` | Central de agentes (cards com disponibilidade real) | Backend IA (opcional) |
| `/admin/escritorio/tarefas` | Central de tarefas | Novas tabelas |
| `/admin/escritorio/aprovacoes` | Central de aprovações | Novas tabelas |
| `/admin/escritorio/ti` | Central de T.I. (solicitações técnicas) | Novas tabelas; execução via Ambiente A |
| `/admin/escritorio/ideias` | Laboratório Criativo | Backend IA para análise |
| `/admin/escritorio/campanhas` | Campanhas (fluxo Ideia → Análise) | Novas tabelas |
| `/admin/escritorio/marketing` | Calendário editorial, banco de ideias, storytelling | Novas tabelas |
| `/admin/escritorio/trafego` | Meta Ads | Meta Marketing API |
| `/admin/escritorio/financeiro` | Receitas, despesas, fluxo de caixa, DRE | `payments` + novas tabelas |
| `/admin/escritorio/whatsapp` | Central de WhatsApp | WhatsApp Cloud API + webhook |
| `/admin/escritorio/crm` | Clientes, origem, conversão, fidelização | `clients` + novas tabelas |
| `/admin/escritorio/estoque` | Insumos, movimentações, alertas | Novas tabelas |
| `/admin/escritorio/dados` | Dashboard executivo + Google Sheets | Sheets API |
| `/admin/escritorio/integracoes` | Estado verificável de cada conexão | — |
| `/admin/escritorio/configuracoes` | Configurações seguras, flags de funcionalidades | — |
| `/admin/escritorio/sobre` | Informações do sistema e créditos RB | — |

As rotas atuais (`/admin`, `/admin/agenda`, ...) continuam iguais. O menu ganha um grupo "Escritório de Inteligência".

## 4. Backend de IA (Ambiente B)

```
Navegador ──> Server Action / Route Handler autenticado (assertPermission)
                 │
                 ├─ carrega definição do especialista (texto versionado no repositório)
                 ├─ monta contexto com dados mínimos necessários (sem dados sensíveis de clientes)
                 ├─ chama a API do modelo com ferramentas internas de LEITURA
                 ├─ ações com efeito externo viram "propostas" na Central de Aprovações
                 └─ registra uso (tokens, custo estimado) em agent_runs
```

- Sem `ANTHROPIC_API_KEY`: cards mostram "IA indisponível — backend não configurado"; módulos operacionais funcionam normalmente. Nenhuma resposta é simulada.
- Limite de gasto mensal configurável; bloqueio automático ao atingir.

## 5. Permissões

Novo modelo, compatível com o atual (`owner`/`staff` continuam válidos):

| Papel | Descrição |
|---|---|
| `owner` | Julia Santos — acesso total |
| `agency` | RB Assessoria — marketing, campanhas, tráfego, dados agregados, T.I.; **sem** observações íntimas de clientes |
| `tech_admin` | Responsável técnico — Central de T.I., integrações, configurações |
| `staff` | Colaboradores — somente permissões concedidas |

Permissões por recurso (`escritorio.financeiro.ver`, `escritorio.aprovacoes.decidir`, ...) em tabela própria, verificadas no servidor e na RLS. Revogáveis a qualquer momento; toda mudança vai para `audit_logs`.

## 6. Regras de execução

- Nenhuma ação externa (publicar anúncio, enviar WhatsApp, alterar preço, deploy) acontece sem um registro aprovado na Central de Aprovações.
- Mudanças de código pedidas na Central de T.I. viram tarefa; a implementação ocorre no Ambiente A, em branch separada, com testes e prévia (deploy de preview da Vercel). Produção só após aprovação.
- O painel nunca executa comandos de sistema a partir de mensagens.

## 7. Créditos institucionais

Componente `<RealizacaoRB />` (logo `public/brand/rb-assessoria-logo.png` + "REALIZAÇÃO · RB ASSESSORIA & COMUNICAÇÃO"), discreto e responsivo, em: rodapé do painel, tela inicial do escritório e página `/admin/escritorio/sobre`. Nunca aplicado automaticamente em materiais de marketing destinados às clientes.

## 8. Identidade visual

Reaproveitar os tokens existentes em `src/app/globals.css` (marfim, champagne, dourado, tinta) e acrescentar um rosa suave (`--color-blush`) para destaques, conforme a logomarca. Logomarca original da Julia em `public/brand/` — não alterar.
