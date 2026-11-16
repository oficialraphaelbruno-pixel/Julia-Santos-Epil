/**
 * Administrador geral: permissões por área, troca de senha e criação de login (ambiente LOCAL).
 * Pré-requisito: usuário raphael.teste@exemplo.com.br com profiles.is_platform_admin = true.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const JULIA = process.env.E2E_EMAIL ?? "julia.teste@exemplo.com.br";
const ADMIN = process.env.E2E_ADMIN_EMAIL ?? "raphael.teste@exemplo.com.br";
const PASSWORD = process.env.E2E_PASSWORD ?? "TesteLocal2026";
if (!/localhost|127\.0\.0\.1/.test(BASE)) process.exit(1);

const sql = (q) => execFileSync("psql", [DB_URL, "-At", "-c", q], { encoding: "utf8" }).trim();
const results = [];
async function step(id, name, fn) {
  try {
    const d = await fn();
    results.push(true);
    console.log(`✅ ${id} — ${name}${d ? ` (${d})` : ""}`);
  } catch (e) {
    results.push(false);
    console.log(`❌ ${id} — ${name} (${e.message.split("\n")[0]})`);
  }
}

sql("delete from rate_limits");
const juliaId = sql(`select id from auth.users where email='${JULIA}'`);
sql(`update business_members set permissions='{}' where user_id='${juliaId}'`);
const stamp = Date.now().toString().slice(-5);
const browser = await chromium.launch();

async function login(email, password = PASSWORD) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/login`);
  await p.fill("#email", email);
  await p.fill("#password", password);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL(`${BASE}/admin`, { timeout: 15000 });
  return { ctx, p };
}

const admin = await login(ADMIN);
const ap = admin.p;

await step("P1", "Administrador geral bloqueia Cupons e Financeiro para a Julia", async () => {
  await ap.locator("aside").getByRole("link", { name: "Usuários e permissões" }).click();
  await ap.waitForURL(`${BASE}/admin/usuarios`);
  const card = ap.getByTestId(`usuario-${JULIA}`);
  await card.getByTestId("perm-cupons").getByRole("switch").click();
  await card.getByTestId("perm-financeiro").getByRole("switch").click();
  await card.getByText("2 área(s) bloqueada(s)").waitFor();
  await card.getByTestId("salvar-permissoes").click();
  await ap.getByText("Permissões salvas.").waitFor();
  const perms = sql(`select permissions::text from business_members where user_id='${juliaId}'`);
  if (perms !== '{"cupons": false, "financeiro": false}') throw new Error(`banco: ${perms}`);
  if (await ap.getByTestId(`usuario-${ADMIN}`).getByTestId("perm-cupons").count()) throw new Error("admin geral com permissões editáveis");
  await ap.screenshot({ path: "tests/e2e/screenshots/usuarios-permissoes.png", fullPage: true });
  return perms;
});

await step("P2", "Julia não vê a tela de usuários, o Financeiro some e Cupons fica só para consulta", async () => {
  const { ctx, p } = await login(JULIA);
  if (await p.locator("aside").getByRole("link", { name: "Usuários e permissões" }).count()) throw new Error("Julia vê Usuários");
  if (await p.locator("aside").getByRole("link", { name: "Financeiro" }).count()) throw new Error("Financeiro no menu");
  await p.goto(`${BASE}/admin/usuarios`);
  if (!p.url().endsWith("/admin?erro=permissao")) throw new Error(`não bloqueou /admin/usuarios: ${p.url()}`);
  await p.goto(`${BASE}/admin/financeiro`);
  await p.getByTestId("area-bloqueada").getByText("Financeiro").waitFor();
  await p.goto(`${BASE}/admin/cupons`);
  await p.getByTestId("area-bloqueada").getByText("Cupons").waitFor();
  if (await p.getByTestId("novo-cupom").count()) throw new Error("botão Novo cupom visível");
  const r = await p.request.get(`${BASE}/admin/exportar/financeiro.csv`);
  if (r.status() !== 403) throw new Error(`CSV financeiro liberado: ${r.status()}`);
  await p.goto(`${BASE}/admin/servicos`);
  if (await p.getByTestId("area-bloqueada").count()) throw new Error("Serviços aparece bloqueado sem motivo");
  await ctx.close();
  return "menu, página, botão e exportação";
});

await step("P3", "Administrador geral troca a senha da Julia (e ela entra com a nova)", async () => {
  await ap.goto(`${BASE}/admin/usuarios`);
  await ap.getByTestId(`usuario-${JULIA}`).getByTestId("alterar-senha").click();
  await ap.fill("#pw-new", "NovaSenha2026x");
  await ap.fill("#pw-confirm", "NovaSenha2026x");
  await ap.getByTestId("salvar-senha").click();
  await ap.getByText("Senha alterada.").waitFor();
  const { ctx } = await login(JULIA, "NovaSenha2026x");
  await ctx.close();
  // volta para a senha padrão dos testes
  await ap.getByTestId(`usuario-${JULIA}`).getByTestId("alterar-senha").click();
  await ap.fill("#pw-new", PASSWORD);
  await ap.fill("#pw-confirm", PASSWORD);
  await ap.getByTestId("salvar-senha").click();
  await ap.getByText("Senha alterada.").waitFor();
  return "nova senha funcionou; restaurada";
});

const novo = `novo${stamp}@exemplo.com.br`;
await step("P4", "Administrador geral cria um novo login, que já consegue entrar", async () => {
  await ap.goto(`${BASE}/admin/usuarios`);
  await ap.getByTestId("novo-login").click();
  await ap.fill("#nu-email", novo);
  await ap.fill("#nu-pass", "SenhaNova2026a");
  await ap.fill("#nu-confirm", "SenhaNova2026a");
  await ap.getByTestId("criar-login").click();
  await ap.getByText("Login criado.").waitFor();
  await ap.getByTestId(`usuario-${novo}`).waitFor();
  const { ctx } = await login(novo, "SenhaNova2026a");
  await ctx.close();
  return novo;
});

sql(`update business_members set permissions='{}' where user_id='${juliaId}'`);
sql(`delete from business_members where user_id=(select id from auth.users where email='${novo}')`);
await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\nUsuários e permissões: ${ok}/${results.length} aprovados.`);
process.exit(ok === results.length ? 0 : 1);
