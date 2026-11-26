/**
 * Programa de indicação (ambiente LOCAL): configuração, link da cliente, desconto da amiga,
 * histórico de quem indicou, desconto liberado ao concluir e aplicado no próximo agendamento.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { pickDay } from "./pick-day.mjs";

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
const biz = sql(`select id from businesses where slug='julia-santos-epil'`);
sql(`update business_members set permissions='{}' where business_id='${biz}'`);
sql(`insert into services (business_id, name, price_cents, duration_minutes) values ('${biz}', 'Axila ${stamp}', 5000, 30)`);
const svc = sql(`select id from services where name='Axila ${stamp}'`);
const anaPhone = `3198${stamp}11`.slice(0, 11);
const anaEmail = `ana${stamp}@exemplo.com.br`;
const anaId = sql(
  `insert into clients (business_id, full_name, phone, email, source) values ('${biz}', 'Ana Indicadora ${stamp}', '55${anaPhone}', '${anaEmail}', 'admin') returning id`,
).split("\n")[0];
const friendPhone = `3197${stamp}22`.slice(0, 11);
const friendEmail = `amiga${stamp}@exemplo.com.br`;

const browser = await chromium.launch();
const admin = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const ap = await admin.newPage();
await ap.goto(`${BASE}/admin/login`);
await ap.fill("#email", EMAIL);
await ap.fill("#password", PASSWORD);
await ap.getByRole("button", { name: "Entrar" }).click();
await ap.waitForURL(`${BASE}/admin`);

await step("R1", "Julia ativa o programa: quem indica ganha 10%, a amiga ganha R$ 10,00, validade 60 dias", async () => {
  await ap.locator("aside").getByRole("link", { name: "Indicações" }).click();
  await ap.waitForURL(`${BASE}/admin/indicacoes`);
  const form = ap.getByTestId("referral-settings");
  if ((await form.getByTestId("referral-enabled").getAttribute("aria-checked")) !== "true") await form.getByTestId("referral-enabled").click();
  await form.locator("select").nth(0).selectOption("percent");
  await ap.fill("#ref-reward", "10");
  await form.locator("select").nth(1).selectOption("fixed");
  await ap.fill("#ref-friend", "10,00");
  await ap.fill("#ref-days", "60");
  await ap.getByTestId("salvar-indicacao").click();
  await ap.getByText(/salvo/i).first().waitFor();
  const row = sql(`select enabled||'|'||reward_type||'|'||reward_value||'|'||friend_type||'|'||friend_value||'|'||reward_valid_days from referral_programs where business_id='${biz}'`);
  if (row !== "true|percent|10|fixed|1000|60") throw new Error(`banco: ${row}`);
  return row;
});

let link = "";
await step("R2", "Ficha da Ana mostra o link pessoal de indicação", async () => {
  await ap.goto(`${BASE}/admin/clientes/${anaId}`);
  link = (await ap.getByTestId("cliente-link-indicacao").innerText()).trim();
  if (!/\/indicacao\/ana\d*$/.test(link)) throw new Error(`link: ${link}`);
  return link;
});
const code = link.split("/").pop();

await step("R3", "O link redireciona para o agendamento com a indicação", async () => {
  const r = await ap.request.get(`${BASE}/indicacao/${code}`, { maxRedirects: 0 });
  const loc = r.headers()["location"] ?? "";
  if (r.status() !== 307 || !loc.includes(`/agendar/julia-santos-epil?indicacao=${code.toUpperCase()}`)) throw new Error(`${r.status()} ${loc}`);
  return loc.replace(BASE, "");
});

async function book(p, { name, phone, email, expectDiscount }) {
  await pickDay(p, 3);
  const slots = p.locator("button[aria-pressed]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor();
  await slots.nth(Math.floor(Math.random() * 3)).click();
  await p.fill("#fullName", name);
  await p.fill("#phone", `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`);
  await p.fill("#email", email);
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  if (expectDiscount) await p.getByTestId("referral-discount").waitFor();
  await p.getByTestId("terms-checkbox").check();
  await p.getByTestId("privacy-checkbox").check();
  await p.getByTestId("confirm-booking").click();
  await p.getByText("Agendamento realizado com sucesso! ✨").waitFor({ timeout: 20000 });
}

await step("R4", "Amiga nova agenda pelo link: vê quem indicou e ganha R$ 10,00 (R$ 50 → R$ 40)", async () => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/indicacao/${code}`);
  await p.waitForURL(/indicacao=/);
  await p.goto(`${p.url()}&servico=${svc}`);
  await p.getByTestId("referral-banner").getByText("Ana").waitFor();
  await p.screenshot({ path: "tests/e2e/screenshots/indicacao-amiga.png" });
  await book(p, { name: `Amiga Indicada ${stamp}`, phone: friendPhone, email: friendEmail, expectDiscount: true });
  await p.getByTestId("referral-card").waitFor();
  await p.screenshot({ path: "tests/e2e/screenshots/indicacao-confirmacao.png", fullPage: true });
  await ctx.close();
  const row = sql(
    `select a.price_cents||'|'||a.referral_discount_cents||'|'||(c.referred_by_client_id='${anaId}')||'|'||r.status from appointments a join clients c on c.id=a.client_id join referrals r on r.referred_client_id=c.id where c.phone='55${friendPhone}'`,
  );
  if (row !== "4000|1000|true|pending") throw new Error(`banco: ${row}`);
  return row;
});

await step("R5", "Mesma amiga não ganha de novo (não é mais cliente nova)", async () => {
  const r = sql(`select count(*) from referral_preview('${biz}', '${svc}', '55${friendPhone}', '${friendEmail}', '${code}')`);
  if (r !== "0") throw new Error(`prévia: ${r}`);
  return "sem desconto";
});

await step("R6", "Julia conclui o atendimento da amiga: Ana ganha 10% e o histórico mostra quem indicou", async () => {
  const apptId = sql(`select a.id from appointments a join clients c on c.id=a.client_id where c.phone='55${friendPhone}'`);
  await ap.goto(`${BASE}/admin/agenda/${apptId}`);
  await ap.getByTestId("agendamento-desconto-indicacao").getByText("R$ 10,00").waitFor();
  await ap.getByTestId("btn-concluir").click();
  await ap.getByText("Atendimento concluído.").waitFor();
  const row = sql(
    `select r.status||'|'||w.status||'|'||w.discount_type||'|'||w.discount_value||'|'||(w.expires_at::date - now()::date) from referrals r join referral_rewards w on w.referral_id=r.id where r.referrer_client_id='${anaId}'`,
  );
  if (row !== "qualified|available|percent|10|60") throw new Error(`banco: ${row}`);
  await ap.goto(`${BASE}/admin/indicacoes`);
  const item = ap.getByTestId("referral-list").locator(":scope > div").filter({ hasText: `Ana Indicadora ${stamp}` });
  await item.getByText(`Amiga Indicada ${stamp}`).waitFor();
  await item.getByText(/disponível/).waitFor();
  await ap.screenshot({ path: "tests/e2e/screenshots/indicacoes-painel.png", fullPage: true });
  await ap.goto(`${BASE}/admin/clientes/${anaId}`);
  await ap.getByTestId("desconto-disponivel").getByText("10%").waitFor();
  await ap.getByTestId("indicacoes-feitas").getByText(`Amiga Indicada ${stamp}`).waitFor();
  const friendId = sql(`select id from clients where phone='55${friendPhone}'`);
  await ap.goto(`${BASE}/admin/clientes/${friendId}`);
  await ap.getByTestId("indicada-por").getByText(`Ana Indicadora ${stamp}`).waitFor();
  return row;
});

await step("R7", "E-mail diferente do cadastro não libera o desconto da Ana", async () => {
  const r = sql(`select count(*) from referral_preview('${biz}', '${svc}', '55${anaPhone}', 'outro${stamp}@exemplo.com.br', null)`);
  if (r !== "0") throw new Error(`prévia: ${r}`);
  return "sem desconto";
});

await step("R8", "Ana agenda com o mesmo WhatsApp e e-mail: 10% aplicado sozinho (R$ 50 → R$ 45)", async () => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/agendar/julia-santos-epil?servico=${svc}`);
  await book(p, { name: `Ana Indicadora ${stamp}`, phone: anaPhone, email: anaEmail, expectDiscount: true });
  await ctx.close();
  const row = sql(
    `select a.price_cents||'|'||a.referral_discount_cents||'|'||w.status||'|'||(w.used_appointment_id=a.id) from appointments a join referral_rewards w on w.id=a.referral_reward_id where a.client_id='${anaId}'`,
  );
  if (row !== "4500|500|used|true") throw new Error(`banco: ${row}`);
  return row;
});

await step("R9", "Se o agendamento com desconto for cancelado, o desconto volta para a Ana", async () => {
  const apptId = sql(`select id from appointments where client_id='${anaId}' order by created_at desc limit 1`);
  await ap.goto(`${BASE}/admin/agenda/${apptId}`);
  await ap.getByTestId("agendamento-desconto-indicacao").waitFor();
  await ap.getByTestId("btn-cancelar").click();
  await ap.getByTestId("btn-confirmar-cancelamento").click();
  await ap.getByText("Agendamento cancelado.").waitFor();
  const st = sql(`select status from referral_rewards where client_id='${anaId}'`);
  if (st !== "available") throw new Error(`desconto: ${st}`);
  return st;
});

sql(`update referral_programs set enabled=false where business_id='${biz}'`);
await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\nIndicações: ${ok}/${results.length} aprovados.`);
process.exit(ok === results.length ? 0 : 1);
