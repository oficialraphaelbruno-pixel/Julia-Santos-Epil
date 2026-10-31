import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Token de gerenciamento do agendamento: 256 bits aleatórios. Só o hash vai ao banco. */
export function newManageToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidTokenFormat(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
