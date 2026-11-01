/**
 * Sinal via Pix + orientações pré/pós (ambiente LOCAL, após `npm run test:e2e`).
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MAILPIT = "http://127.0.0.1:54324";
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
async function waitMail(to, re, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const r = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    const m = (r.messages ?? []).find((x) => re.test(x.Subject));
    if (m) return (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json());
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`e-mail ${re} não chegou`);
}
function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const stamp = Date.now().toString().slice(-5);
const service = sql(`select name from services where status='active' and show_online order by created_at desc limit 1`);
sql(`update services set pre_care_text = 'Evite cremes no dia. (teste ${stamp})', post_care_text = 'Evite sol por 24h. (teste ${stamp})' where name = '${service}'`);
sql(`update booking_settings set deposit_enabled = true, deposit_percent = 50`);
const price = Number(sql(`select price_cents from services where name='${service}'`));
const clientEmail = `sinal${stamp}@exemplo.com.br`;

const browser = await chromium.launch();
let reference = "";

await step("S1", "Revisão mostra o sinal de 50% e exige aceitar os termos", async () => {
  const c = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await c.newPage();
  await p.goto(`${BASE}/agendar/julia-santos-epil`);
  await p.getByRole("button", { name: new RegExp(service) }).click();
  await p.locator("[role=gridcell]:not([disabled])").nth(5).click();
  const slots = p.locator("button[aria-pressed]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor();
  await slots.nth(1).click();
  await p.fill("#fullName", "Sofia Sinal Teste");
  await p.fill("#phone", `(31) 96666-${stamp.slice(0, 4)}`);
  await p.fill("#email", clientEmail);
  await p.locator("input[name=privacy]").check();
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  await p.getByTestId("deposit-notice").waitFor();
  const btn = p.getByTestId("confirm-booking");
  if (!(await btn.isDisabled())) throw new Error("confirmar habilitado sem aceite dos termos");
  await p.getByTestId("terms-checkbox").check();
  await p.screenshot({ path: "tests/e2e/screenshots/mobile-sinal-revisao.png", fullPage: true });
  await btn.click();
  await p.getByText("Agendamento realizado com sucesso! ✨").waitFor();
  reference = (await p.getByTestId("booking-reference").textContent()).trim();
  const amount = (await p.getByTestId("deposit-amount").textContent()).trim();
  const payload = (await p.getByTestId("pix-payload").textContent()).trim();
  if (crc16(payload.slice(0, -4)) !== payload.slice(-4)) throw new Error("CRC do Pix inválido");
  if (!payload.includes("+5531998628886")) throw new Error("chave Pix ausente no copia e cola");
  const expected = (Math.round(price / 2) / 100).toFixed(2);
  if (!payload.includes(`54${String(expected.length).padStart(2, "0")}${expected}`)) throw new Error(`valor do Pix diferente de ${expected}`);
  await p.screenshot({ path: "tests/e2e/screenshots/mobile-sinal-pix.png", fullPage: true });
  await c.close();
  return `${reference}: sinal ${amount}, Pix copia e cola válido`;
});

await step("S2", "Banco: pendente com sinal aguardando; e-mail com sinal e orientações pré", async () => {
  const row = sql(`select status || '|' || deposit_status || '|' || deposit_cents from appointments where reference_code='${reference}'`);
  if (row !== `pending|aguardando|${Math.round(price / 2)}`) throw new Error(`banco: ${row}`);
  const m = await waitMail(clientEmail, /falta o sinal/);
  if (!m.Text.includes("+55") && !m.Text.includes("(31) 99862-8886")) throw new Error("chave Pix ausente no e-mail");
  if (!m.Text.includes(`Evite cremes no dia. (teste ${stamp})`)) throw new Error("orientações pré ausentes");
  return "pendente/aguardando; e-mail com Pix e orientações";
});

const admin = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const ap = await admin.newPage();
await ap.goto(`${BASE}/admin/login`);
await ap.fill("#email", EMAIL);
await ap.fill("#password", PASSWORD);
await ap.getByRole("button", { name: "Entrar" }).click();
await ap.waitForURL(`${BASE}/admin`);

await step("S3", "Painel lista sinais pendentes e a Julia confirma o recebimento", async () => {
  await ap.getByTestId("pending-deposits").getByText("Sofia Sinal Teste").waitFor();
  const id = sql(`select id from appointments where reference_code='${reference}'`);
  await ap.goto(`${BASE}/admin/agenda/${id}`);
  const href = await ap.getByTestId("wa-sinal").getAttribute("href");
  if (!new URL(href).searchParams.get("text").includes("Julia Caroline Pereira dos Santos")) throw new Error("cobrança do sinal sem favorecida");
  await ap.getByTestId("btn-sinal-recebido").click();
  await ap.getByText("Sinal registrado e agendamento confirmado.").waitFor();
  const row = sql(`select a.status || '|' || a.deposit_status || '|' || (select count(*) from payments p where p.appointment_id=a.id and p.notes='Sinal do agendamento') from appointments a where a.id='${id}'`);
  if (row !== "confirmed|pago|1") throw new Error(`banco: ${row}`);
  await waitMail(clientEmail, /Agendamento confirmado/);
  await ap.screenshot({ path: "tests/e2e/screenshots/admin-sinal-recebido.png", fullPage: true });
  return "pagamento registrado no financeiro + e-mail de confirmação";
});

await step("S4", "Concluir o atendimento envia as orientações pós", async () => {
  const id = sql(`select id from appointments where reference_code='${reference}'`);
  await ap.goto(`${BASE}/admin/agenda/${id}`);
  await ap.getByTestId("btn-concluir").click();
  await ap.getByText("Atendimento concluído.").waitFor();
  const m = await waitMail(clientEmail, /Cuidados após/);
  if (!m.Text.includes(`Evite sol por 24h. (teste ${stamp})`)) throw new Error("texto pós ausente");
  await ap.reload();
  if (!(await ap.getByTestId("wa-orientacoes_pos").count())) throw new Error("botão de WhatsApp pós ausente");
  return "e-mail pós + botão WhatsApp";
});

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\nSinal e orientações: ${ok}/${results.length} aprovados.`);
process.exit(ok === results.length ? 0 : 1);
