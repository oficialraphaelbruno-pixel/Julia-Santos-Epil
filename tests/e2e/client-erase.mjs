/**
 * Apagar dados da cliente (LGPD) e botão do modo escuro em telas baixas (ambiente LOCAL).
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
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

const stamp = Date.now().toString().slice(-6);
const biz = sql(`select id from businesses where slug='julia-santos-epil'`);
const svc = sql(`select id from services where business_id='${biz}' and status='active' limit 1`);
const pro = sql(`select id from professionals where business_id='${biz}' limit 1`);
const semHist = sql(`insert into clients (business_id, full_name, phone, email, marketing_consent) values ('${biz}', 'Sem Historico ${stamp}', '553197${stamp}1', 'sem${stamp}@exemplo.com', true) returning id`).split("\n")[0];
const comHist = sql(`insert into clients (business_id, full_name, phone, email, marketing_consent, notes) values ('${biz}', 'Com Historico ${stamp}', '553197${stamp}2', 'com${stamp}@exemplo.com', true, 'alergia a X') returning id`).split("\n")[0];
const days = (Number(stamp) % 300) + 30;
const appt = sql(`insert into appointments (business_id, client_id, service_id, professional_id, starts_at, ends_at, duration_minutes, service_name, reference_code, price_cents, status, source, client_message)
  values ('${biz}', '${comHist}', '${svc}', '${pro}', now() - interval '${days} days', now() - interval '${days} days' + interval '30 minutes', 30, 'Teste', 'T${stamp}', 5000, 'completed', 'admin', 'mensagem pessoal') returning id`).split("\n")[0];
sql(`insert into message_logs (business_id, appointment_id, channel, template, recipient, status) values ('${biz}', '${appt}', 'email', 'confirm', 'com${stamp}@exemplo.com', 'sent')`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/admin/login`);
await p.fill("#email", EMAIL);
await p.fill("#password", PASSWORD);
await p.getByRole("button", { name: "Entrar" }).click();
await p.waitForURL(`${BASE}/admin`);

async function erase(id) {
  await p.goto(`${BASE}/admin/clientes/${id}`);
  await p.getByTestId("apagar-cliente").click();
  const btn = p.getByTestId("apagar-confirmar");
  if (await btn.isEnabled()) throw new Error("botão liberado sem digitar APAGAR");
  await p.getByTestId("apagar-confirmacao").fill("apagar");
  await btn.click();
}

await step("A1", "Cliente sem atendimentos é excluída por completo", async () => {
  await erase(semHist);
  await p.waitForURL(`${BASE}/admin/clientes`);
  if (sql(`select count(*) from clients where id='${semHist}'`) !== "0") throw new Error("cadastro continua no banco");
});

await step("A2", "Cliente com histórico tem os dados pessoais apagados e o histórico mantido", async () => {
  await erase(comHist);
  await p.getByText("Dados pessoais apagados").waitFor();
  const row = sql(`select full_name || '|' || coalesce(email,'') || '|' || coalesce(notes,'') || '|' || marketing_consent from clients where id='${comHist}'`);
  if (row !== "Cliente anonimizada|||false") throw new Error(`cliente: ${row}`);
  const a = sql(`select price_cents || '|' || coalesce(client_message,'') from appointments where id='${appt}'`);
  if (a !== "5000|") throw new Error(`atendimento: ${a}`);
  const log = sql(`select coalesce(recipient,'') from message_logs where appointment_id='${appt}'`);
  if (log !== "") throw new Error(`destinatário ainda no histórico: ${log}`);
  await p.getByTestId("cliente-apagada").waitFor();
  if (await p.getByText("Dados apagados").count() === 0) throw new Error("telefone fictício aparece na ficha");
  if (await p.getByTestId("apagar-cliente").count()) throw new Error("botões continuam na ficha");
  await p.goto(`${BASE}/admin/clientes`);
  const html = await p.content();
  if (html.includes(`/admin/clientes/${comHist}`)) throw new Error("cliente apagada continua na lista");
  return "dados apagados, valor mantido, some da lista e não mostra o telefone fictício";
});

await step("T2", "Botão do modo escuro visível em notebook de tela baixa", async () => {
  const short = await browser.newContext({ viewport: { width: 1366, height: 650 }, storageState: await ctx.storageState() });
  const sp = await short.newPage();
  for (const path of ["/admin", "/admin/agenda", "/admin/clientes"]) {
    await sp.goto(`${BASE}${path}`);
    const t = sp.locator("[data-testid=theme-toggle]:visible").first();
    const box = await t.boundingBox();
    if (!box || box.y + box.height > 650) throw new Error(`${path}: botão fora da tela`);
    await t.click();
    await sp.waitForFunction(() => document.documentElement.classList.contains("admin-dark"));
    await t.click();
    await sp.waitForFunction(() => !document.documentElement.classList.contains("admin-dark"));
  }
  await short.close();
  return "painel, agenda e clientes";
});

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\nApagar dados e tema: ${ok}/${results.length} aprovados.`);
process.exit(ok === results.length ? 0 : 1);
