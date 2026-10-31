/**
 * Normaliza telefones brasileiros para E.164 sem "+" (ex.: 5531998628886).
 * Aceita entradas como "(31) 99862-8886", "31998628886", "+55 31 99862-8886".
 */
export function normalizeBrazilPhone(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;
  let d = digits;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (d.startsWith("55")) {
    const national = d.slice(2);
    if (national.length !== 10 && national.length !== 11) return null;
    const ddd = Number(national.slice(0, 2));
    if (ddd < 11 || ddd > 99) return null;
    if (national.length === 11 && national[2] !== "9") return null;
    return d;
  }
  // Número internacional (fora do Brasil)
  return d.length >= 10 && d.length <= 15 ? d : null;
}

/** Formata para exibição: +55 (31) 99862-8886 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  if (e164.startsWith("55") && (e164.length === 12 || e164.length === 13)) {
    const n = e164.slice(2);
    const ddd = n.slice(0, 2);
    const rest = n.slice(2);
    const a = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const b = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `(${ddd}) ${a}-${b}`;
  }
  return `+${e164}`;
}
