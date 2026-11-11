/** Normaliza o código vindo de um link (?cupom=...). Retorna null se o formato for inválido. */
export function cleanCouponCode(raw: string | string[] | undefined | null): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const code = value.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9_-]{3,30}$/.test(code) ? code : null;
}

