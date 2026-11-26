/**
 * FAQ, assistente Mel e lista de e-mails (ambiente LOCAL).
 * A OpenAI é simulada por um servidor local: inicie o site com
 *   OPENAI_API_KEY=teste-local OPENAI_BASE_URL=http://127.0.0.1:4555/v1 npm start
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
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

// ---------- OpenAI simulada ----------
let lastRequest = null;
const mock = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    lastRequest = { auth: req.headers.authorization, body: JSON.parse(body || "{}") };
    const msgs = lastRequest.body.messages ?? [];
    const last = (msgs[msgs.length - 1]?.content ?? "").toLowerCase();
    let reply = { resposta: "Oi, flor! Antes da epilação, siga os cuidados do seu serviço 🌸", respondeu: true, acoes: ["agendar"] };
    if (last.includes("promo")) reply = { resposta: "Deixa seu e-mail que eu te aviso das promoções 💛", respondeu: true, acoes: ["novidades"] };
    if (last.includes("estacionamento")) reply = { resposta: "Essa eu não sei, flor. Fala com a Julia no WhatsApp?", respondeu: false, acoes: ["whatsapp"] };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: JSON.stringify(reply) } }] }));
  });
});
await new Promise((r) => mock.listen(4555, "127.0.0.1", r));

mkdirSync("tests/e2e/screenshots", { recursive: true });
sql("delete from rate_limits");
const stamp = Date.now().toString().slice(-5);
const biz = sql(`select id from businesses where slug='julia-santos-epil'`);
sql(`update business_members set permissions='{}' where business_id='${biz}'`);
sql(`update assistant_settings set enabled=false, daily_limit=300 where business_id='${biz}'`);
sql(`delete from assistant_logs where business_id='${biz}'`);
sql(`insert into services (business_id, name, price_cents, duration_minutes, pre_care_text, post_care_text) values
     ('${biz}', 'Virilha ${stamp}', 6000, 40, 'Antes ${stamp}: não depile com lâmina 15 dias antes.', 'Depois ${stamp}: evite piscina por 24h.')`);
const pixBefore = sql(`select coalesce(pix_key,'') || '|' || coalesce(pix_key_type,'') from booking_settings where business_id='${biz}'`).split("|");
sql(`update booking_settings set pix_key='+5531988887777', pix_key_type='telefone', deposit_enabled=true, deposit_percent=50 where business_id='${biz}'`);

const browser = await chromium.launch();
const admin = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const ap = await admin.newPage();
await ap.goto(`${BASE}/admin/login`);
await ap.fill("#email", EMAIL);
await ap.fill("#password", PASSWORD);
await ap.getByRole("button", { name: "Entrar" }).click();
await ap.waitForURL(`${BASE}/admin`);

const question = `Atende aos sábados ${stamp}?`;
await step("F1", "Julia escreve uma pergunta no painel e ela aparece na página Dúvidas", async () => {
  await ap.locator("aside").getByRole("link", { name: "FAQ e assistente Mel" }).click();
  await ap.waitForURL(`${BASE}/admin/assistente`);
  await ap.getByTestId("nova-pergunta").click();
  await ap.selectOption("#faq-cat", "agendamento");
  await ap.fill("#faq-q", question);
  await ap.fill("#faq-a", `Resposta escrita pela Julia ${stamp}.`);
  await ap.getByTestId("salvar-pergunta").click();
  await ap.getByText("Pergunta adicionada.").waitFor();
  await ap.getByTestId(`faq-row-${question}`).waitFor();
  const p = await browser.newPage();
  await p.goto(`${BASE}/duvidas`);
  const item = p.getByTestId("faq-agendamento").getByText(question);
  await item.click();
  await p.getByText(`Resposta escrita pela Julia ${stamp}.`).waitFor();
  await p.close();
  return question;
});

await step("F2", "Página Dúvidas mostra cuidados por serviço, sinal e Instagram (tudo do cadastro)", async () => {
  const p = await browser.newPage({ ...devices["iPhone 13"] });
  await p.goto(`${BASE}/duvidas`);
  await p.getByTestId("care-pre").getByText(`Virilha ${stamp}`).click();
  await p.getByText(`Antes ${stamp}: não depile com lâmina 15 dias antes.`).waitFor();
  await p.getByTestId("care-pos").getByText(`Virilha ${stamp}`).click();
  await p.getByText(`Depois ${stamp}: evite piscina por 24h.`).waitFor();
  await p.getByTestId("auto-sinal").click();
  await p.getByTestId("auto-sinal").getByText("50%").waitFor();
  if (await p.getByText("98888-7777").count()) throw new Error("chave Pix exposta na página pública");
  if (await p.getByTestId("mel-open").count()) throw new Error("assistente aparece desligada");
  await p.screenshot({ path: "tests/e2e/screenshots/duvidas.png", fullPage: true });
  await p.close();
  return "cuidados, sinal; Mel escondida enquanto desligada";
});

const nlEmail = `novidade${stamp}@exemplo.com.br`;
await step("N1", "Visitante se inscreve no “Fique por dentro” da página inicial (com correção de e-mail digitado errado)", async () => {
  const p = await browser.newPage();
  await p.goto(`${BASE}/#novidades`);
  const form = p.getByTestId("newsletter-site");
  await form.locator("input[type=email]").fill(`teste${stamp}@gmial.com`);
  await form.getByRole("button", { name: "Quero receber" }).click();
  await form.getByText(`Você quis dizer teste${stamp}@gmail.com?`).waitFor();
  await form.locator("input[type=email]").fill(nlEmail);
  await form.getByRole("button", { name: "Quero receber" }).click();
  await p.getByTestId("newsletter-ok").waitFor();
  await p.close();
  const row = sql(`select source || '|' || (consent_at is not null) from newsletter_subscribers where email='${nlEmail}'`);
  if (row !== "site|true") throw new Error(`banco: ${row}`);
  return row;
});

await step("E1", "Aba E-mails lista a inscrita, filtra por origem, exporta CSV para o Resend e remove", async () => {
  await ap.locator("aside").getByRole("link", { name: "E-mails (novidades)" }).click();
  await ap.waitForURL(`${BASE}/admin/emails`);
  await ap.getByTestId("email-lista").getByText(nlEmail).waitFor();
  await ap.selectOption("select[name=origem]", "site");
  await ap.getByTestId("email-filtrar").click();
  await ap.waitForURL(/origem=site/);
  const rows = await ap.getByTestId("email-row").allInnerTexts();
  if (!rows.every((r) => r.includes("Página inicial"))) throw new Error("filtro de origem falhou");
  const csv = await (await ap.request.get(`${BASE}/admin/exportar/emails.csv?origem=site`)).text();
  if (!csv.startsWith("email,first_name,last_name") || !csv.includes(nlEmail)) throw new Error(`CSV: ${csv.slice(0, 80)}`);
  await ap.screenshot({ path: "tests/e2e/screenshots/emails-painel.png", fullPage: true });
  ap.once("dialog", (d) => d.accept());
  await ap.getByTestId("email-row").filter({ hasText: nlEmail }).getByTestId("email-remover").click();
  await ap.getByText("E-mail removido da lista de novidades.").waitFor();
  if (sql(`select unsubscribed_at is not null from newsletter_subscribers where email='${nlEmail}'`) !== "t") throw new Error("não descadastrou");
  const anon = await browser.newContext();
  const r = await anon.request.get(`${BASE}/admin/exportar/emails.csv`, { maxRedirects: 0 });
  const body = await r.text();
  if (r.status() === 200 && body.includes("email,first_name")) throw new Error("lista exportada sem login");
  if (![302, 303, 307, 401].includes(r.status())) throw new Error(`exportação sem login: ${r.status()}`);
  await anon.close();
  return "filtro, CSV, remoção; exportação bloqueada sem login";
});

await step("M1", "Julia liga a Mel; o balão aparece e responde usando os dados do studio", async () => {
  await ap.goto(`${BASE}/admin/assistente`);
  await ap.getByTestId("assistant-enabled").click();
  await ap.getByTestId("salvar-assistente").click();
  await ap.getByText("Configurações da assistente salvas.").waitFor();
  await ap.getByTestId("assistant-status").getByText("No ar").waitFor();
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/`);
  await p.getByTestId("mel-open").click();
  await p.getByTestId("mel-panel").getByText("Eu sou a Mel").waitFor();
  await p.screenshot({ path: "tests/e2e/screenshots/mel-aberta.png" });
  await p.getByTestId("mel-quick").getByRole("button", { name: "Como me preparar? 🌸" }).click();
  await p.getByTestId("mel-msg-assistant").nth(1).getByText("Antes da epilação").waitFor();
  await p.getByTestId("mel-action-agendar").waitFor();
  await p.screenshot({ path: "tests/e2e/screenshots/mel-resposta.png" });
  const system = lastRequest.body.messages[0].content;
  for (const must of [`Antes ${stamp}`, `Depois ${stamp}`, "(31) 98888-7777", question, "Nunca invente"]) {
    if (!system.includes(must)) throw new Error(`instruções sem: ${must}`);
  }
  if (lastRequest.auth !== "Bearer teste-local") throw new Error("chave não enviada");
  await ctx.close();
  return `modelo ${lastRequest.body.model}; prompt com cuidados, Pix e FAQ`;
});

const melEmail = `mel${stamp}@exemplo.com.br`;
await step("M2", "Mel oferece as promoções e a pessoa deixa o e-mail no chat", async () => {
  const p = await browser.newPage();
  await p.goto(`${BASE}/duvidas`);
  await p.getByTestId("mel-open").click();
  await p.getByTestId("mel-input").fill("Tem alguma promoção?");
  await p.getByTestId("mel-send").click();
  const box = p.getByTestId("mel-action-novidades");
  await box.waitFor();
  await box.locator("input[type=email]").fill(melEmail);
  await box.getByRole("button", { name: "Quero receber" }).click();
  await box.getByTestId("newsletter-ok").waitFor();
  await p.close();
  const src = sql(`select source from newsletter_subscribers where email='${melEmail}'`);
  if (src !== "assistente") throw new Error(`origem: ${src}`);
  return src;
});

await step("M3", "Pergunta que a Mel não soube vai para o painel; Julia responde no FAQ", async () => {
  const p = await browser.newPage();
  await p.goto(`${BASE}/`);
  await p.getByTestId("mel-open").click();
  await p.getByTestId("mel-input").fill(`Tem estacionamento ${stamp}? Meu número é 31 99999 8888`);
  await p.keyboard.press("Enter");
  await p.getByTestId("mel-action-whatsapp").waitFor();
  await p.close();
  const saved = sql(`select question from assistant_logs where business_id='${biz}' and answered=false order by id desc limit 1`);
  if (saved.includes("99999")) throw new Error("telefone guardado no registro");
  await ap.goto(`${BASE}/admin/assistente`);
  const list = ap.getByTestId("unanswered");
  await list.getByText(`Tem estacionamento ${stamp}?`).waitFor();
  await list.getByTestId("responder-pergunta").first().click();
  await ap.fill("#faq-a", "Sim, tem vaga na rua em frente.");
  await ap.getByTestId("salvar-pergunta").click();
  await ap.getByText("Pergunta adicionada.").waitFor();
  await ap.reload();
  if (await ap.getByTestId("unanswered").getByText(`Tem estacionamento ${stamp}?`).count()) throw new Error("continuou na lista");
  return saved;
});

await step("M4", "Limite diário protege o crédito da OpenAI", async () => {
  sql(`update assistant_settings set daily_limit=10 where business_id='${biz}'`);
  sql(`insert into assistant_logs (business_id, question) select '${biz}', 'x' from generate_series(1,10)`);
  sql("delete from rate_limits");
  lastRequest = null;
  const p = await browser.newPage();
  await p.goto(`${BASE}/`);
  await p.getByTestId("mel-open").click();
  await p.getByTestId("mel-input").fill("Oi");
  await p.getByTestId("mel-send").click();
  await p.getByText("estou descansando").waitFor();
  await p.close();
  if (lastRequest) throw new Error("chamou a OpenAI acima do limite");
  return "sem chamada à OpenAI";
});

// limpeza
sql(`update booking_settings set pix_key=nullif('${pixBefore[0]}',''), pix_key_type=nullif('${pixBefore[1]}','') where business_id='${biz}'`);
sql(`update assistant_settings set enabled=false, daily_limit=300 where business_id='${biz}'`);
sql(`delete from assistant_logs where business_id='${biz}'`);
sql(`delete from faq_items where business_id='${biz}' and (question like '%${stamp}%' or answer like '%vaga na rua%')`);
sql(`update services set status='archived' where name='Virilha ${stamp}'`);
await browser.close();
mock.close();
const ok = results.filter(Boolean).length;
console.log(`\nFAQ, Mel e e-mails: ${ok}/${results.length} aprovados.`);
process.exit(ok === results.length ? 0 : 1);
