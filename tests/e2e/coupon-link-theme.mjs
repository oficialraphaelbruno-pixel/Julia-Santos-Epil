/**
 * Link de cupom e modo escuro do painel (ambiente LOCAL).
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const EMAIL = process.env.E2E_EMAIL ?? "julia.teste@exemplo.com.br";
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

mkdirSync("tests/e2e/screenshots", { recursive: true });
sql("delete from rate_limits");
const stamp = Date.now().toString().slice(-5);
const CODE = `LINK${stamp}`;
const biz = sql(`select id from businesses where slug='julia-santos-epil'`);
const svc = sql(
  `insert into services (business_id, name, price_cents, duration_minutes) values ('${biz}', 'Virilha Link ${stamp}', 10000, 30) returning id`,
).split("\n")[0];
sql(`insert into coupons (business_id, code, discount_type, discount_value, service_ids, once_per_client)
     values ('${biz}', '${CODE}', 'percent', 30, array['${svc}']::uuid[], true)`);

const browser = await chromium.launch();
const admin = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const ap = await admin.newPage();
await ap.goto(`${BASE}/admin/login`);
await ap.fill("#email", EMAIL);
await ap.fill("#password", PASSWORD);
await ap.getByRole("button", { name: "Entrar" }).click();
await ap.waitForURL(`${BASE}/admin`);

await step("L1", "Painel mostra o link do cupom para copiar", async () => {
  await ap.goto(`${BASE}/admin/cupons`);
  const box = ap.getByTestId(`cupom-${CODE}`).getByTestId("cupom-link");
  await box.getByText(`${BASE}/cupom/${CODE}`).waitFor();
  await box.getByText("O link já abre com o serviço do cupom escolhido.").waitFor();
  await ap.getByTestId(`cupom-${CODE}`).screenshot({ path: "tests/e2e/screenshots/cupom-link.png" });
  return `${BASE}/cupom/${CODE}`;
});

const phone = `3197${stamp}12`.slice(0, 11);
await step("L2", "Cliente abre o link curto, serviço já escolhido, e-mail obrigatório e desconto aplicado na revisão", async () => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/cupom/${CODE.toLowerCase()}?utm_source=instagram`);
  const url = new URL(p.url());
  if (url.pathname !== "/agendar/julia-santos-epil" || url.searchParams.get("cupom") !== CODE || url.searchParams.get("utm_source") !== "instagram")
    throw new Error(`redirecionou para ${p.url()}`);
  await p.getByTestId("link-coupon-banner").getByText(`30% de desconto em Virilha Link ${stamp}`).waitFor();
  await p.screenshot({ path: "tests/e2e/screenshots/cupom-link-cliente.png" });
  // serviço do cupom já escolhido: abre direto no calendário
  await p.locator("[role=gridcell]:not([disabled])").nth(5).click();
  const slots = p.locator("button[aria-pressed]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor();
  await slots.first().click();
  await p.fill("#fullName", "Cliente Link Cupom");
  await p.fill("#phone", `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`);
  await p.locator("input[name=privacy]").check();
  // e-mail obrigatório e com checagem de erro de digitação
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  await p.getByText("Informe seu e-mail").waitFor();
  await p.fill("#email", `link${stamp}@gmail.comc`);
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  await p.getByText(`você quis dizer link${stamp}@gmail.com?`).waitFor();
  await p.fill("#email", `link${stamp}@exemplo.com.br`);
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  await p.getByTestId("coupon-box").getByText("aplicado: −R$ 30,00").waitFor({ timeout: 10000 });
  const terms = p.getByTestId("terms-checkbox");
  if (await terms.count()) await terms.check();
  await p.getByTestId("confirm-booking").click();
  await p.getByText("Agendamento realizado com sucesso! ✨").waitFor({ timeout: 20000 });
  const row = sql(`select coupon_code || '|' || discount_cents || '|' || price_cents from appointments where service_id='${svc}' order by created_at desc limit 1`);
  if (row !== `${CODE}|3000|7000`) throw new Error(`banco: ${row}`);
  await ctx.close();
  return "R$ 100,00 → R$ 70,00";
});

await step("L3", "Link de cupom inexistente avisa e deixa agendar normalmente", async () => {
  const p = await browser.newPage();
  await p.goto(`${BASE}/agendar/julia-santos-epil?cupom=NAOEXISTE99`);
  await p.getByTestId("link-coupon-unavailable").waitFor();
  if (await p.getByTestId("link-coupon-banner").count()) throw new Error("banner apareceu para cupom inválido");
  await p.close();
});

await step("T1", "Modo escuro no painel: alterna, lembra ao recarregar e não afeta o site", async () => {
  await ap.goto(`${BASE}/admin`);
  await ap.getByTestId("theme-toggle").first().click();
  await ap.waitForFunction(() => document.documentElement.classList.contains("admin-dark"));
  const cookie = (await admin.cookies()).find((c) => c.name === "painel_tema");
  if (cookie?.value !== "escuro") throw new Error(`cookie: ${cookie?.value}`);
  await ap.reload();
  const ssr = await ap.locator("#painel-root").getAttribute("class");
  if (!ssr.includes("admin-dark")) throw new Error("não abriu no modo escuro após recarregar");
  const bg = await ap.evaluate(() => getComputedStyle(document.getElementById("painel-root")).backgroundColor);
  if (!/rgb\((1[0-9]|2[0-9]), /.test(bg)) throw new Error(`fundo não ficou escuro: ${bg}`);
  await ap.screenshot({ path: "tests/e2e/screenshots/painel-escuro.png" });
  await ap.goto(`${BASE}/admin/cupons`);
  await ap.screenshot({ path: "tests/e2e/screenshots/painel-escuro-cupons.png" });
  await ap.getByRole("button", { name: "Editar" }).first().click();
  await ap.getByRole("dialog").waitFor();
  const dlg = await ap.evaluate(() => getComputedStyle(document.querySelector("[role=dialog]")).backgroundColor);
  await ap.screenshot({ path: "tests/e2e/screenshots/painel-escuro-dialogo.png" });
  await ap.keyboard.press("Escape");
  // site público continua claro, mesmo com o cookie
  await ap.goto(`${BASE}/`);
  const pub = await ap.evaluate(() => ({ dark: document.documentElement.classList.contains("admin-dark"), bg: getComputedStyle(document.body).backgroundColor }));
  if (pub.dark) throw new Error("site público ficou escuro");
  // volta ao modo claro
  await ap.goto(`${BASE}/admin`);
  await ap.getByTestId("theme-toggle").first().click();
  await ap.waitForFunction(() => !document.documentElement.classList.contains("admin-dark"));
  await ap.screenshot({ path: "tests/e2e/screenshots/painel-claro.png" });
  return `painel ${bg}, diálogo ${dlg}, site ${pub.bg}`;
});

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} cenários aprovados`);
process.exit(ok === results.length ? 0 : 1);
