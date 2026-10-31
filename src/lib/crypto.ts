import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Deriva um segredo independente a partir da chave secreta do Supabase (HMAC),
 * para que a publicação exija apenas UMA variável secreta. Se a variável
 * específica existir, ela tem prioridade.
 */
export function derivedSecret(label: string, explicit?: string) {
  if (explicit && explicit.length >= 32) return explicit;
  const base = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!base) return "";
  return createHmac("sha256", base).update(`studio-manager:${label}:v1`).digest("hex");
}

/** Chave AES de 32 bytes (somente servidor). */
function key() {
  const raw = derivedSecret("integrations-encryption", process.env.INTEGRATIONS_ENCRYPTION_KEY);
  if (!raw) throw new Error("Chave de criptografia indisponível (configure SUPABASE_SECRET_KEY).");
  return createHash("sha256").update(raw).digest();
}

export function hasEncryptionKey() {
  return derivedSecret("integrations-encryption", process.env.INTEGRATIONS_ENCRYPTION_KEY).length >= 32;
}

/** AES-256-GCM. Formato: v1.<iv>.<tag>.<dados> (base64url). */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptSecret(payload: string) {
  const [v, iv, tag, data] = payload.split(".");
  if (v !== "v1") throw new Error("Formato de segredo desconhecido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
