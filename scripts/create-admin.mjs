#!/usr/bin/env node
/**
 * Cria (ou vincula) a usuária administradora de uma empresa.
 *
 * Uso:
 *   node --env-file=.env.local scripts/create-admin.mjs --email julia@exemplo.com [--slug julia-santos-epil] [--role owner|staff]
 *
 * Senha:
 *   - Se a variável ADMIN_PASSWORD estiver definida, ela será usada.
 *   - Caso contrário, uma senha forte e aleatória é gerada e exibida UMA vez.
 *     Troque-a no primeiro acesso (Configurações > Segurança) ou use "Esqueci minha senha".
 *
 * Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (somente no terminal/servidor).
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => (cur.startsWith("--") ? [...acc, [cur.slice(2), arr[i + 1]]] : acc), []),
);
const email = (args.email ?? "").trim().toLowerCase();
const slug = args.slug ?? process.env.NEXT_PUBLIC_DEFAULT_BUSINESS_SLUG ?? "julia-santos-epil";
const role = args.role === "staff" ? "staff" : "owner";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Informe um e-mail válido: --email nome@dominio.com");
  process.exit(1);
}
if (!url || !key) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (ex.: node --env-file=.env.local ...).");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: business, error: bErr } = await db.from("businesses").select("id, name").eq("slug", slug).maybeSingle();
if (bErr || !business) {
  console.error(`Empresa "${slug}" não encontrada. Aplique as migrations primeiro.`);
  process.exit(1);
}

const provided = process.env.ADMIN_PASSWORD;
if (provided && (provided.length < 10 || !/[A-Za-z]/.test(provided) || !/\d/.test(provided))) {
  console.error("ADMIN_PASSWORD deve ter ao menos 10 caracteres, com letras e números.");
  process.exit(1);
}
const password = provided ?? randomBytes(15).toString("base64url") + "9a";

// Procura usuária existente
let userId = null;
for (let page = 1; page <= 20 && !userId; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) break;
  userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
  if (data.users.length < 200) break;
}

let created = false;
if (!userId) {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error("Falha ao criar usuária:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  created = true;
}

const { error: mErr } = await db.from("business_members").upsert({ business_id: business.id, user_id: userId, role }, { onConflict: "business_id,user_id" });
if (mErr) {
  console.error("Falha ao vincular à empresa:", mErr.message);
  process.exit(1);
}

if (role === "owner") {
  await db.from("professionals").update({ user_id: userId }).eq("business_id", business.id).is("user_id", null).order("created_at").limit(1);
}

console.log(`\n✔ ${email} vinculada a "${business.name}" como ${role === "owner" ? "proprietária" : "funcionária"}.`);
if (created && !provided) {
  console.log(`\n  Senha temporária (exibida apenas agora): ${password}\n  Troque-a no primeiro acesso em Configurações > Segurança.\n`);
} else if (!created) {
  console.log("  A usuária já existia; a senha não foi alterada.");
}
