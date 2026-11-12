/** Consulta de agendamento pela cliente (ambiente LOCAL). */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
if (!/localhost|127\.0\.0\.1/.test(BASE)) process.exit(1);
const sql = (q) => execFileSync("psql", [DB_URL, "-At", "-c", q], { encoding: "utf8" }).trim();
const results = [];
async function step(id, name, fn) {
  try { const d = await fn(); results.push(true); console.log(`✅ ${id} — ${name}${d ? ` (${d})` : ""}`); }
  catch (e) { results.push(false); console.log(`❌ ${id} — ${name} (${e.message.split("\n")[0]})`); }
}
// ambiente local: zera o limitador de abuso para a bateria de testes não ser bloqueada
sql("delete from rate_limits");
const stamp = Date.now().toString().slice(-5);
const email = `consulta${stamp}@exemplo.com.br`;
const phoneDigits = `9333${stamp.slice(0, 4)}`;
const service = sql(`select name from services where status='active' and show_online order by sort_order, name limit 1`);
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
let reference = "";

await step("Q1", "Cliente agenda informando e-mail", async () => {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/agendar/julia-santos-epil`);
  await p.getByTestId("link-consultar").waitFor();
  await p.getByRole("button", { name: new RegExp(service) }).click();
  await p.locator("[role=gridcell]:not([disabled])").nth(7).click();
  const slots = p.locator("button[aria-pressed]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor();
  await slots.first().click();
  await p.fill("#fullName", "Júlia Consulta Teste");
  await p.fill("#phone", `(31) ${phoneDigits.slice(0, 5)}-${phoneDigits.slice(5)}`);
  await p.fill("#email", email);
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  const terms = p.getByTestId("terms-checkbox");
  await terms.check();
  await p.getByTestId("privacy-checkbox").check();
  await p.getByTestId("confirm-booking").click();
  try {
    await p.getByText("Agendamento realizado com sucesso! ✨").waitFor({ timeout: 20000 });
  } catch (e) {
    await p.screenshot({ path: "tests/e2e/screenshots/debug-consulta.png", fullPage: true });
    const alert = await p.locator("[role=alert]").allTextContents();
    throw new Error(`não concluiu: ${alert.join(" | ")}`);
  }
  reference = (await p.getByTestId("booking-reference").textContent()).trim();
  await p.close();
  return reference;
});

await step("Q2", "Nome errado não revela nada", async () => {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/agendar/julia-santos-epil/consultar`);
  await p.fill("#cs-contact", email);
  await p.fill("#cs-name", "Outra Pessoa");
  await p.getByTestId("consultar").click();
  await p.getByTestId("consulta-erro").getByText("Não encontramos agendamentos").waitFor();
  await p.close();
});

await step("Q3", "E-mail + nome (sem acento e maiúsculas) mostra o agendamento, Pix e Google Agenda", async () => {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/agendar/julia-santos-epil/consultar`);
  await p.fill("#cs-contact", email.toUpperCase());
  await p.fill("#cs-name", "  julia consulta TESTE ");
  await p.getByTestId("consultar").click();
  await p.getByTestId(`consulta-${reference}`).waitFor();
  const href = await p.getByTestId("consulta-google").getAttribute("href");
  if (!href.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE")) throw new Error("link do Google ausente");
  const loc = new URL(href).searchParams.get("location") ?? "";
  const addr = sql(`select address_line from businesses where slug='julia-santos-epil'`);
  if (addr && !loc.includes(addr)) throw new Error(`evento sem endereço: "${loc}"`);
  const deposit = sql(`select deposit_status from appointments where reference_code='${reference}'`);
  if (deposit === "aguardando") {
    await p.getByTestId("deposit-card").waitFor();
    await p.getByTestId("deposit-steps").getByText("Como pagar o sinal").waitFor();
  }
  await p.screenshot({ path: "tests/e2e/screenshots/mobile-consulta.png", fullPage: true });
  await p.close();
  return `sinal: ${deposit}`;
});

await step("Q4", "WhatsApp + nome também funciona", async () => {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/agendar/julia-santos-epil/consultar`);
  await p.fill("#cs-contact", `31${phoneDigits}`);
  await p.fill("#cs-name", "Júlia Consulta Teste");
  await p.getByTestId("consultar").click();
  await p.getByTestId(`consulta-${reference}`).waitFor();
  await p.close();
});

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\nConsulta de agendamento: ${ok}/${results.length} aprovados.`);
process.exit(ok === results.length ? 0 : 1);
