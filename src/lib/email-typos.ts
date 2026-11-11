/**
 * Detecta erros comuns de digitação em e-mails (ex.: "gmial.com", ".comc").
 * Retorna a sugestão corrigida ou null quando não há erro conhecido.
 */
const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  "gmail.comc": "gmail.com",
  "gmail.com.br": "gmail.com",
  "hotmal.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.comc": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.con": "outlook.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "icloud.con": "icloud.com",
  "icoud.com": "icloud.com",
};
const TLD_FIXES: [RegExp, string][] = [
  [/\.comc$/, ".com"],
  [/\.con$/, ".com"],
  [/\.cpm$/, ".com"],
  [/\.cmo$/, ".com"],
  [/\.com\.b$/, ".com.br"],
  [/\.com\.brr$/, ".com.br"],
  [/\.br\.com$/, ".com.br"],
];

export function suggestEmailFix(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const user = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (DOMAIN_FIXES[domain]) return `${user}@${DOMAIN_FIXES[domain]}`;
  for (const [re, fix] of TLD_FIXES) if (re.test(domain)) return `${user}@${domain.replace(re, fix)}`;
  return null;
}
