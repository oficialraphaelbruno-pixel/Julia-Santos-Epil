# Resultados de testes — Fase 1

Executados em 31/10/2026, ambiente **local** (Supabase local via Docker + build de produção do Next.js, Chromium/Playwright).
Nenhum resultado abaixo foi simulado; integrações externas não configuradas estão marcadas como pendentes.

## Automatizados
| Suite | Comando | Resultado |
|---|---|---|
| Unitários (telefone, moeda, datas/fuso, WhatsApp, ICS, validação) | `npm test` | 16/16 ✅ |
| Banco: regras de agenda, conflitos, cancelamento, reagendamento, bloqueios, feriados, prazos, RLS, permissões, auditoria | `npm run test:db` | todos ✅ |
| Ponta a ponta no navegador | `npm run test:e2e` | 14/14 ✅ |

## Testes obrigatórios
| # | Teste | Status | Evidência |
|---|---|---|---|
| 1 | Julia cadastra um serviço | ✅ | gravado no banco (R$ 85,00 / 60 min) |
| 2 | Julia define dias e horários | ✅ | 7 dias + almoço salvos |
| 3 | Cliente vê os serviços na página pública | ✅ | celular (iPhone 13) |
| 4 | Cliente seleciona data e horário disponíveis | ✅ | calendário mostra só dias/horários livres |
| 5 | Agendamento salvo no banco | ✅ | referência AG-XXXXXX, status pendente |
| 6 | Agendamento aparece no painel | ✅ | Agenda e Painel de Controle |
| 7 | Mesmo horário não pode ser reservado por outra cliente | ✅ | duas clientes confirmando **ao mesmo tempo**: 1 aceita, 1 recusada com alternativas; restrição `EXCLUDE` no PostgreSQL |
| 8 | Julia cancela e reagenda | ✅ | painel + cliente pelo link seguro |
| 9 | WhatsApp abre a conversa com mensagem personalizada | ✅ | link oficial `wa.me/55…?text=…` com o modelo de confirmação |
| 10 | Google Agenda sincroniza | ⏳ pendente | integração da Fase 2 (precisa de credenciais OAuth) |
| 11 | Não autorizados não acessam o painel | ✅ | sem login → login; conta sem vínculo recusada; cadastro público bloqueado; API anônima sem dados |
| 12 | Computador e smartphone | ✅ | 11 páginas × 2 tamanhos sem rolagem horizontal |
| 13 | Link público fora do ambiente de desenvolvimento | ⏳ pendente | depende da publicação |
| 14 | Dados de uma empresa não acessíveis a outra | ✅ | testes SQL com duas empresas e duas usuárias |

Extra: recuperação de senha por e-mail testada de ponta a ponta (servidor de e-mail local Mailpit).

# Fase 2 — resultados

| Suite | Comando | Resultado |
|---|---|---|
| Unitários (inclui criptografia de tokens e lógica do Google com respostas **simuladas**) | `npm test` | 22/22 ✅ |
| Fase 1 (regressão) | `npm run test:e2e` | 14/14 ✅ |
| Fase 2 no navegador | `npm run test:e2e:fase2` | 7/7 ✅ |

Fase 2 verificada de verdade (servidor SMTP local, sem simulação):
- E-mail ao agendar (com link de gerenciamento e logomarca), ao confirmar e ao cancelar.
- Modelos editáveis aplicados aos botões de WhatsApp.
- Lembretes: rota recusa acesso sem segredo (401); véspera enviada uma única vez em execuções repetidas.
- Verificação em duas etapas: sem código o painel fica bloqueado; código errado recusado.
- Tela de Integrações mostra o estado real (Google: aguardando credenciais).

**TESTE 10 (Google Agenda real): pendente** até a configuração das credenciais OAuth. Nada foi simulado como "conectado".

# Sinal via Pix — resultados
| Suite | Resultado |
|---|---|
| Unitários (inclui CRC do Pix validado com o exemplo oficial do Banco Central) | 25/25 ✅ |
| Banco: sinal de 50%, pendente até confirmação, reagendamento não confirma sozinho | ✅ |
| `npm run test:e2e:sinal` (navegador + e-mails reais no SMTP local) | 4/4 ✅ |
| `npm run test:e2e:link-tema` (link de cupom + modo escuro do painel) | 4/4 ✅ |
| Regressão Fase 1 / Fase 2 | 14/14 ✅ · 7/7 ✅ |
