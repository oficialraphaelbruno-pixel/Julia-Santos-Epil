---
name: fechamento-financeiro
description: Fechamento financeiro mensal da Julia Santos Epil — receitas, despesas, lucro, margem, ticket médio, DRE gerencial e conferência de consistência. Use no fim do mês ou quando pedirem "como foi o mês", "fechamento", "DRE".
---

# Fechamento financeiro

1. Defina o período (mês fechado, fuso America/Sao_Paulo).
2. Colete (somente leitura): `payments` do período (pagamento − estorno), `appointments` concluídos, `expenses` (quando existir), gastos de anúncios.
3. **Conferência** antes de calcular:
   - atendimentos `completed` sem pagamento lançado;
   - pagamentos sem atendimento vinculado;
   - sinais Pix `pago` sem lançamento em `payments`.
   Liste cada divergência com referência (código do agendamento), sem corrigir nada.
4. Acione `diretor-financeiro` com os dados e as divergências.
5. Entregue: DRE gerencial (receita bruta, descontos, receita líquida, custos variáveis, margem de contribuição, despesas fixas, marketing, resultado), ticket médio, faturamento por serviço, comparativo com mês anterior, premissas.
6. Lançamentos de correção são **propostas** para a usuária confirmar.
