/** Normaliza o código vindo de um link (?cupom=...). Retorna null se o formato for inválido. */
export function cleanCouponCode(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const code = value.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9_-]{3,30}$/.test(code) ? code : null;
}


/** Código de indicação (letras e números, 4–20). Retorna null se inválido. */
export function cleanReferralCode(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const code = value.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9]{4,20}$/.test(code) ? code : null;
}

/** "10% de desconto" ou "R$ 20,00 de desconto" */
export function discountText(type: string, value: number) {
  return type === "percent" ? `${value}% de desconto` : `${(value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de desconto`;
}
