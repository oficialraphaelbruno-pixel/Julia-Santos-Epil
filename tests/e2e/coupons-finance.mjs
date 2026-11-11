/**
 * Cupons, ordem dos serviços e financeiro (ambiente LOCAL, após `npm run test:e2e`).
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

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

// ambiente local: zera o limitador de abuso para a bateria de testes não ser bloqueada
sql("delete from rate_limits");
const stamp = Date.now().toString().slice(-5);
const CODE = `TESTE${stamp}`;
const browser = await chromium.launch();
const admin = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const ap = await admin.newPage();
await ap.goto(`${BASE}/admin/login`);
await ap.fill("#email", EMAIL);
await ap.fill("#password", PASSWORD);
await ap.getByRole("button", { name: "Entrar" }).click();
await ap.waitForURL(`${BASE}/admin`);

// dois serviços de teste na mesma categoria
const biz = sql(`select id from businesses where slug='julia-santos-epil'`);
const cat = sql(`insert into service_categories (business_id, name) values ('${biz}', 'Categoria ${stamp}') returning id`).split("\n")[0];
sql(`insert into services (business_id, category_id, name, price_cents, duration_minutes) values
     ('${biz}', '${cat}', 'Axilas ${stamp}', 4000, 30), ('${biz}', '${cat}', 'Virilha ${stamp}', 8000, 60)`);

await step("O1", "Julia muda a ordem dos serviços e o site segue a nova ordem", async () => {
  await ap.goto(`${BASE}/admin/servicos`);
  await ap.getByRole("button", { name: `Mover Virilha ${stamp} para cima` }).click();
  await ap.waitForFunction(
    (st) => {
      const names = [...document.querySelectorAll("[data-testid^='servico-']")].map((e) => e.getAttribute("data-testid"));
      return names.indexOf(`servico-Virilha ${st}`) < names.indexOf(`servico-Axilas ${st}`);
    },
    stamp,
    { timeout: 10000 },
  );
  const order = sql(`select string_agg(name, ',' order by sort_order, name) from services where category_id='${cat}'`);
  if (order !== `Virilha ${stamp},Axilas ${stamp}`) throw new Error(`banco: ${order}`);
  const pub = await browser.newPage();
  await pub.goto(`${BASE}/`);
  const html = await pub.content();
  if (html.indexOf(`Virilha ${stamp}`) > html.indexOf(`Axilas ${stamp}`)) throw new Error("site não seguiu a nova ordem");
  await pub.close();
  return "Virilha antes de Axilas no painel, no banco e no site";
});

await step("C1", "Julia cria cupom personalizado com limite de usos", async () => {
  await ap.goto(`${BASE}/admin/cupons`);
  await ap.getByTestId("novo-cupom").click();
  await ap.fill("#cp-code", CODE.toLowerCase());
  await ap.fill("#cp-value", "20");
  await ap.fill("#cp-max", "1");
  await ap.getByTestId("salvar-cupom").click();
  await ap.getByText("Cupom criado.").waitFor();
  await ap.getByTestId(`cupom-${CODE}`).waitFor();
  const row = sql(`select discount_type || '|' || discount_value || '|' || max_uses || '|' || once_per_client from coupons where code='${CODE}'`);
  if (row !== "percent|20|1|true") throw new Error(`banco: ${row}`);
  return `${CODE}: 20%, 1 uso`;
});

async function reachReview(ctx, phone, name) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/agendar/julia-santos-epil`);
  await p.getByRole("button", { name: new RegExp(`Virilha ${stamp}`) }).click();
  await p.locator("[role=gridcell]:not([disabled])").nth(6).click();
  const slots = p.locator("button[aria-pressed]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor();
  await slots.nth(name.includes("Duda") ? 2 : 0).click();
  await p.fill("#fullName", name);
  await p.fill("#phone", phone);
  await p.fill("#email", `cupom.${phone.replace(/\D/g, "")}@exemplo.com.br`);
  await p.locator("input[name=privacy]").check();
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  await p.getByTestId("coupon-box").waitFor();
  return p;
}

let reference = "";
await step("C2", "Cliente aplica o cupom no site: desconto, sinal recalculado e gravado no agendamento", async () => {
  const c = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await reachReview(c, `(31) 95555-${stamp.slice(0, 4)}`, "Carol Cupom Teste");
  await p.fill("#coupon", "NAOEXISTE");
  await p.getByTestId("apply-coupon").click();
  await p.getByTestId("coupon-error").getByText("Cupom inválido").waitFor();
  await p.fill("#coupon", CODE);
  await p.getByTestId("apply-coupon").click();
  await p.getByText(`Desconto (${CODE})`).waitFor();
  await p.getByText("R$ 64,00").first().waitFor(); // 80,00 − 20%
  const deposit = await p.getByTestId("deposit-notice").textContent();
  if (!deposit.includes("R$ 32,00")) throw new Error(`sinal não recalculado: ${deposit}`);
  await p.screenshot({ path: "tests/e2e/screenshots/mobile-cupom.png", fullPage: true });
  const terms = p.getByTestId("terms-checkbox");
  if (await terms.count()) await terms.check();
  await p.getByTestId("confirm-booking").click();
  await p.getByText("Agendamento realizado com sucesso! ✨").waitFor();
  reference = (await p.getByTestId("booking-reference").textContent()).trim();
  const row = sql(`select price_cents || '|' || discount_cents || '|' || original_price_cents || '|' || coupon_code || '|' || deposit_cents from appointments where reference_code='${reference}'`);
  if (row !== `6400|1600|8000|${CODE}|3200`) throw new Error(`banco: ${row}`);
  await c.close();
  return `${reference}: R$ 80 → R$ 64, sinal R$ 32`;
});

await step("C3", "Cupom esgotado é recusado para outra cliente; painel mostra 1 de 1 uso", async () => {
  const c = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await reachReview(c, `(31) 94444-${stamp.slice(0, 4)}`, "Duda Cupom Teste");
  await p.fill("#coupon", CODE);
  await p.getByTestId("apply-coupon").click();
  await p.getByTestId("coupon-error").getByText("limite de usos").waitFor();
  await c.close();
  await ap.goto(`${BASE}/admin/cupons`);
  const uses = await ap.getByTestId(`cupom-${CODE}`).getByTestId("cupom-usos").textContent();
  if (!uses.includes("1 de 1")) throw new Error(`usos: ${uses}`);
  await ap.goto(`${BASE}/admin/agenda/${sql(`select id from appointments where reference_code='${reference}'`)}`);
  await ap.getByText(CODE).first().waitFor();
  return "esgotado; painel 1 de 1; cupom visível no agendamento";
});

mkdirSync("tests/e2e/tmp", { recursive: true });
const receipt = "tests/e2e/tmp/comprovante.png";
writeFileSync(receipt, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

await step("F1", "Julia lança despesa paga com comprovante e despesa fixa de 3 meses", async () => {
  await ap.goto(`${BASE}/admin/financeiro`);
  await ap.getByTestId("nova-despesa").click();
  await ap.fill("#ex-desc", `Cera ${stamp}`);
  await ap.fill("#ex-amount", "150,00");
  await ap.locator("input[type=file]").setInputFiles(receipt);
  await ap.getByText("anexado", { exact: true }).waitFor();
  await ap.getByTestId("salvar-despesa").click();
  await ap.getByText("Despesa lançada.").waitFor();
  await ap.getByTestId("nova-despesa").click();
  await ap.fill("#ex-desc", `Aluguel ${stamp}`);
  await ap.fill("#ex-cat", "Aluguel");
  await ap.fill("#ex-amount", "900,00");
  await ap.getByRole("switch").first().click(); // não paga
  await ap.selectOption("#ex-repeat", "3");
  await ap.getByTestId("salvar-despesa").click();
  await ap.getByText("3 despesas lançadas.").waitFor();
  const cera = sql(`select (paid_at is not null) || '|' || (receipt_path is not null) from expenses where description='Cera ${stamp}'`);
  const aluguel = sql(`select count(*) || '|' || count(paid_at) || '|' || count(distinct recurrence_group) from expenses where description='Aluguel ${stamp}'`);
  if (cera !== "true|true") throw new Error(`cera: ${cera}`);
  if (aluguel !== "3|0|1") throw new Error(`aluguel: ${aluguel}`);
  const obj = sql(`select count(*) from storage.objects where bucket_id='receipts' and name = (select receipt_path from expenses where description='Cera ${stamp}')`);
  if (obj !== "1") throw new Error("comprovante não armazenado");
  return "paga + comprovante privado; aluguel em 3 parcelas a pagar";
});

await step("F2", "Receita avulsa, pagar despesa e resultado do mês corretos", async () => {
  await ap.getByTestId("nova-receita").click();
  await ap.fill("#in-desc", `Venda óleo ${stamp}`);
  await ap.fill("#in-amount", "60,00");
  await ap.getByTestId("salvar-receita").click();
  await ap.getByText("Receita lançada.").waitFor();
  await ap.getByTestId(`despesa-Aluguel ${stamp}`).first().getByTestId("pagar-despesa").click();
  await ap.getByText("Despesa marcada como paga.").waitFor();
  const month = sql(`select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM-01')`);
  const uid = sql(`select id from auth.users where email='${EMAIL}'`);
  const s = JSON.parse(
    sql(`select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', false); set role authenticated; select admin_finance_summary('${biz}', '${month}')`)
      .split("\n")
      .pop(),
  );
  const expected = { despesasPagas: sql(`select coalesce(sum(amount_cents),0) from expenses where business_id='${biz}' and paid_at >= '${month}'::date and paid_at < ('${month}'::date + interval '1 month')`) };
  if (String(s.despesas_pagas_cents) !== expected.despesasPagas) throw new Error(`despesas pagas ${s.despesas_pagas_cents} ≠ ${expected.despesasPagas}`);
  await ap.reload();
  const kpi = await ap.getByTestId("kpi-Resultado do mês").textContent();
  await ap.screenshot({ path: "tests/e2e/screenshots/admin-financeiro.png", fullPage: true });
  return `resultado exibido: ${kpi.replace(/\s+/g, " ").replace("Resultado do mês", "").trim().slice(0, 40)}`;
});

await step("F3", "Exportação CSV do mês inclui receitas e despesas", async () => {
  const month = sql(`select to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM')`);
  const r = await admin.request.get(`${BASE}/admin/exportar/financeiro.csv?mes=${month}`);
  const text = await r.text();
  if (!text.includes(`Venda óleo ${stamp}`) || !text.includes(`Cera ${stamp}`) || !text.includes("-150,00")) throw new Error("CSV incompleto");
  const anon = await browser.newContext();
  const r2 = await anon.request.get(`${BASE}/admin/exportar/financeiro.csv?mes=${month}`, { maxRedirects: 0 });
  if (r2.status() === 200 && (await r2.text()).includes("Cera")) throw new Error("CSV acessível sem login");
  await anon.close();
  return "CSV OK e protegido";
});

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\nCupons, ordem e financeiro: ${ok}/${results.length} aprovados.`);
process.exit(ok === results.length ? 0 : 1);
