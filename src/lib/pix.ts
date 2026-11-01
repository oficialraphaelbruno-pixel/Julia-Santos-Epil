/**
 * Pix "copia e cola" (BR Code estático) conforme o Manual de Padrões para
 * Iniciação do Pix do Banco Central (EMV QRCPS-MPM + CRC16-CCITT).
 */
function ascii(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "");
}

function tlv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixInput {
  key: string;
  name: string;
  city?: string | null;
  amountCents?: number;
  txid?: string;
  description?: string;
}

export function buildPixPayload(p: PixInput) {
  const name = ascii(p.name).toUpperCase().slice(0, 25) || "RECEBEDOR";
  const city = ascii(p.city || "BRASIL").toUpperCase().slice(0, 15);
  const txid = (p.txid ?? "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const account = tlv("00", "br.gov.bcb.pix") + tlv("01", p.key.trim()) + (p.description ? tlv("02", ascii(p.description).slice(0, 40)) : "");
  const body =
    tlv("00", "01") +
    tlv("26", account) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (p.amountCents && p.amountCents > 0 ? tlv("54", (p.amountCents / 100).toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", name) +
    tlv("60", city) +
    tlv("62", tlv("05", txid)) +
    "6304";
  return body + crc16(body);
}

/** Exibição amigável da chave. */
export function formatPixKey(key: string | null | undefined, type: string | null | undefined) {
  if (!key) return "";
  if (type === "telefone") {
    const d = key.replace(/\D/g, "").replace(/^55/, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return key;
}

export const PIX_KEY_TYPE_LABEL: Record<string, string> = {
  telefone: "Celular",
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  aleatoria: "Chave aleatória",
};

/** Normaliza a chave conforme o tipo (telefone vira +55DDDNUMERO). */
export function normalizePixKey(key: string, type: string) {
  const k = key.trim();
  if (type === "telefone") {
    let d = k.replace(/\D/g, "");
    if (d.length === 10 || d.length === 11) d = "55" + d;
    return d.length >= 12 ? `+${d}` : null;
  }
  if (type === "cpf") return /^\d{11}$/.test(k.replace(/\D/g, "")) ? k.replace(/\D/g, "") : null;
  if (type === "cnpj") return /^\d{14}$/.test(k.replace(/\D/g, "")) ? k.replace(/\D/g, "") : null;
  if (type === "email") return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(k) ? k.toLowerCase() : null;
  if (type === "aleatoria") return /^[0-9a-f-]{32,36}$/i.test(k) ? k.toLowerCase() : null;
  return null;
}
