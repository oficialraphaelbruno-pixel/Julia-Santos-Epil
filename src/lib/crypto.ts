import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Chave de 32 bytes derivada de INTEGRATIONS_ENCRYPTION_KEY (somente servidor). */
function key() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) throw new Error("INTEGRATIONS_ENCRYPTION_KEY ausente ou curta (mínimo 32 caracteres).");
  return createHash("sha256").update(raw).digest();
}

export function hasEncryptionKey() {
  return (process.env.INTEGRATIONS_ENCRYPTION_KEY ?? "").length >= 32;
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
