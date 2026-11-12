import "server-only";
import QRCode from "qrcode";
import { buildPixPayload, formatPixKey } from "@/lib/pix";

export interface DepositInfo {
  amountCents: number;
  status: string;
  dueAt: string | null;
  payload: string | null;
  qrSvg: string | null;
  keyDisplay: string;
  /** Chave como deve ser colada no app do banco (ex.: +5531998628886). */
  keyValue: string | null;
  keyType: string | null;
  holder: string | null;
  bank: string | null;
  instructions: string | null;
}

export async function buildDepositInfo(opts: {
  amountCents: number;
  status: string;
  dueAt: string | null;
  reference: string;
  settings: { pix_key: string | null; pix_key_type: string | null; pix_holder_name: string | null; pix_bank: string | null; pix_city: string | null; deposit_instructions: string | null };
  fallbackCity?: string | null;
}): Promise<DepositInfo> {
  const s = opts.settings;
  let payload: string | null = null;
  let qrSvg: string | null = null;
  if (s.pix_key && s.pix_holder_name && opts.amountCents > 0) {
    payload = buildPixPayload({
      key: s.pix_key,
      name: s.pix_holder_name,
      city: s.pix_city || opts.fallbackCity,
      amountCents: opts.amountCents,
      txid: opts.reference,
    });
    qrSvg = await QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#252525", light: "#ffffff" } });
  }
  return {
    amountCents: opts.amountCents,
    status: opts.status,
    dueAt: opts.dueAt,
    payload,
    qrSvg,
    keyDisplay: formatPixKey(s.pix_key, s.pix_key_type),
    keyValue: s.pix_key ?? null,
    keyType: s.pix_key_type,
    holder: s.pix_holder_name,
    bank: s.pix_bank,
    instructions: s.deposit_instructions,
  };
}
