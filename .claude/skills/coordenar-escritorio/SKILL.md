---
name: coordenar-escritorio
description: Roteiro do Diretor Executivo para pedidos que envolvem mais de uma área do escritório Julia Santos Epil (campanha, meta, problema do negócio). Use quando o pedido precisar de marketing + financeiro + tráfego + outros setores trabalhando juntos.
---

# Coordenar o escritório

1. **Planejar** — acione o subagente `diretor-executivo` com o pedido. Ele devolve objetivo, informações faltantes e plano de delegação.
2. **Perguntar o que falta** — se faltar dado essencial (orçamento, período, serviço), pergunte à usuária antes de seguir.
3. **Delegar em sequência**, passando o resultado anterior como contexto ao próximo:
   1. `diretor-marketing` — estratégia
   2. `diretor-financeiro` — viabilidade (usa a estratégia)
   3. `gestor-trafego` — mídia paga (usa estratégia + verba aprovada pelo financeiro)
   4. `copywriter` — textos (usa estratégia + estrutura de anúncios)
   5. `gestor-whatsapp-crm` — comunicação autorizada
   6. `gestor-comercial` — acompanhamento das oportunidades
   7. `analista-dados` — indicadores e metas
   Setores independentes entre si podem ser acionados em paralelo (ex.: copywriter e comercial).
4. **Consolidar** — acione `diretor-executivo` novamente com todos os resultados.
5. **Apresentar** um plano único com: fases (IDEIA → ESTRATÉGIA → VIABILIDADE → CRIATIVOS → APROVAÇÃO → EXECUÇÃO → CONVERSÃO → ANÁLISE), responsável e status de cada fase, custos, riscos e a lista de aprovações.
6. **Parar** antes de qualquer execução externa. Aprovação só vale se dada explicitamente pela usuária.
