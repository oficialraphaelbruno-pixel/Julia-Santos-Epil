/** Cálculos do crédito da OpenAI (valores em dólar, como a OpenAI cobra). */

export interface UsageRow {
  day: string;
  messages: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export function estimateCostUsd(promptTokens: number, completionTokens: number, priceInPerM: number, priceOutPerM: number) {
  return (promptTokens / 1_000_000) * priceInPerM + (completionTokens / 1_000_000) * priceOutPerM;
}

export function sumUsage(rows: UsageRow[], fromDay?: string | null, toDay?: string | null) {
  return rows
    .filter((r) => (!fromDay || r.day >= fromDay) && (!toDay || r.day <= toDay))
    .reduce(
      (t, r) => ({ messages: t.messages + Number(r.messages), prompt: t.prompt + Number(r.prompt_tokens), completion: t.completion + Number(r.completion_tokens) }),
      { messages: 0, prompt: 0, completion: 0 },
    );
}

export function creditStatus(input: { creditUsd: number | null; spentUsd: number; lowBalanceUsd: number }) {
  if (input.creditUsd === null) return { balance: null, percentLeft: null, level: "unknown" as const };
  const balance = Math.round((input.creditUsd - input.spentUsd) * 100) / 100;
  const percentLeft = input.creditUsd > 0 ? Math.max(0, Math.min(100, (balance / input.creditUsd) * 100)) : 0;
  const level = balance <= 0 ? ("empty" as const) : balance <= input.lowBalanceUsd ? ("low" as const) : ("ok" as const);
  return { balance, percentLeft, level };
}

export function formatUsd(value: number, digits = 2) {
  return `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
