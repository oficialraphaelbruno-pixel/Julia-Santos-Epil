---
name: solicitacao-ti
description: Atende uma solicitação da Central de T.I. da Julia Santos Epil (novo campo, tela, gráfico, botão, usuário, integração, correção). Use quando chegar um pedido técnico de melhoria ou configuração da plataforma.
---

# Solicitação de T.I.

Acione `diretor-ti` e siga os 12 passos:

1. Receber e reescrever como requisito testável.
2. Analisar o sistema atual (arquivos reais).
3. Verificar viabilidade.
4. Identificar arquivos e módulos envolvidos.
5. Classificar risco (baixo / médio / alto / crítico).
6. Preparar plano (inclui migração aditiva, testes, reversão).
7. Pedir aprovação quando risco ≥ alto, quando mexer em permissões, pagamentos, preços, agenda ou produção.
8. Implementar em branch `escritorio/<assunto>` (nunca em `main` direto).
9. Executar `npm run typecheck`, `npm run lint`, `npm test` (e `npm run test:db` se houver SQL). Reportar o resultado real.
10. Apresentar prévia (deploy de preview da Vercel) e o diff resumido.
11. Registrar em `docs/escritorio/04-STATUS.md`.
12. Preparar publicação — merge/deploy de produção somente com autorização explícita.

Se o pedido puder ser resolvido pelo painel (texto, preço, horário, template), oriente a usuária a fazer pela tela correspondente em vez de alterar código.
