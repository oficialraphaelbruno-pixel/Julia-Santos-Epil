# Plano de banco de dados — Escritório de Inteligência

Fonte oficial: Supabase (PostgreSQL) atual. Google Sheets é cópia de acompanhamento, nunca fonte concorrente.

## Regras
- Toda tabela nova: `business_id uuid not null references businesses(id)`, RLS habilitada, políticas via `is_member()` / nova `has_permission()`.
- Valores monetários em centavos (`integer`), datas em `timestamptz`.
- Nada de `delete` físico em dados financeiros: usar estorno/cancelamento.
- Migrações aditivas apenas (nenhuma coluna existente removida ou renomeada).
- Rascunhos SQL ficam em `docs/escritorio/sql-rascunho/` até serem aplicados e testados no banco de desenvolvimento (`julia-santos-epil-dev`); só então vão para `supabase/migrations/`.

## Situação
| Etapa | Migração | Dev | Produção |
|---|---|---|---|
| 1 — Acesso e escritório | `20261101000400_escritorio_papeis.sql`, `20261101000500_escritorio_base.sql` | Aplicada e testada (16 testes em `supabase/tests/escritorio_permissions.test.sql`) | **Não aplicada** — aguarda autorização |
| 2 a 6 | — | Planejadas | — |

## Reaproveitado (já existe)
`clients` (inclui consentimento de marketing), `services`, `appointments`, `payments`, `audit_logs`, `message_logs`, `notification_settings`, `sync_logs`.

## Novas entidades

### Acesso
| Tabela | Finalidade |
|---|---|
| enum `member_role` + valores `agency`, `tech_admin` | Novos papéis (aditivo) |
| `member_permissions` | (business_id, user_id, permission) — permissões por recurso, revogáveis |

### Escritório
| Tabela | Finalidade |
|---|---|
| `office_tasks` | Central de tarefas: id, solicitante, agente, categoria, descrição, prioridade, status, resultado |
| `office_task_events` | Histórico de cada tarefa |
| `office_attachments` | Anexos (Supabase Storage, bucket privado) |
| `approvals` | Central de aprovações: tipo, referência, payload proposto, status, decidido_por, decidido_em |
| `agent_runs` | Execuções de IA: agente, tarefa, tokens, custo estimado, status, erro |
| `it_requests` | Central de T.I.: risco, arquivos envolvidos, plano, branch, URL de prévia, status |
| `feature_flags` | Ativação de funcionalidades por empresa |

### Financeiro
| Tabela | Finalidade |
|---|---|
| `expense_categories` | Categorias (fixo/variável, marketing, insumos, taxas...) |
| `expenses` | Despesas e contas a pagar (vencimento, pago_em, recorrência) |
| `receivables` | Contas a receber que não vêm de `payments` |
| `financial_goals` | Metas mensais |
| view `cash_flow_daily` | Entradas (`payments`) − saídas (`expenses`) |

### Marketing, tráfego e CRM
| Tabela | Finalidade |
|---|---|
| `ideas` | Laboratório Criativo: ideia original + análise estruturada (jsonb) |
| `campaigns` | Campanhas com fase (ideia → análise), responsável, orçamento aprovado |
| `campaign_phases` | Status e responsável por fase |
| `creatives` | Textos, conceitos, links Canva |
| `content_calendar` | Calendário editorial |
| `brand_story_facts` | Fatos biográficos **confirmados** pela Julia (com data de confirmação) |
| `leads` | Contatos: origem, campanha, status, cliente vinculada |
| `conversions` | Lead → agendamento → atendimento → pagamento |
| `ad_accounts`, `ad_insights_daily` | Meta Ads (somente leitura no início) |

### WhatsApp
| Tabela | Finalidade |
|---|---|
| `wa_conversations`, `wa_messages` | Conversas/mensagens recebidas pelo webhook |
| `wa_templates` | Modelos aprovados na Meta |
| `contact_preferences` | Preferências e descadastro (complementa `clients.marketing_consent`) |
| `webhook_events` | Idempotência de webhooks (id do evento único) |

### Operações
| Tabela | Finalidade |
|---|---|
| `products`, `suppliers` | Insumos e fornecedores |
| `stock_movements` | Entradas/saídas (saldo calculado, nunca editado à mão) |
| `service_consumption` | Insumo consumido por serviço (custo por atendimento) |
| `equipment`, `maintenance_logs` | Equipamentos e manutenção |
| `checklists`, `checklist_runs` | Checklists operacionais |

### Satisfação e sincronização
| Tabela | Finalidade |
|---|---|
| `satisfaction_surveys` | Pesquisas pós-atendimento |
| `referrals` | Indicações |
| `sheet_sync_runs` | Exportações para Google Sheets: aba, linhas, hash, erro |
| `scheduled_jobs` | Execuções de rotinas (cron), com idempotência e tentativas |

## Ordem de migração
1. Acesso (papéis + permissões) e escritório (tarefas, aprovações, agent_runs, it_requests).
2. Financeiro.
3. Marketing/campanhas/leads.
4. WhatsApp e Meta Ads.
5. Operações/estoque.
6. Satisfação e sincronização.

Cada etapa: testar em banco de desenvolvimento → testes SQL → backup do banco de produção → aplicar → verificar advisors.
