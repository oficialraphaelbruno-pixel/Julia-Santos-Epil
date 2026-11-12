/**
 * Testes funcionais de ponta a ponta (navegador real via Playwright).
 *
 * Pré-requisitos (ambiente LOCAL — nunca rode contra produção):
 *   1. npx supabase start && npx supabase db reset
 *   2. ADMIN_PASSWORD='TesteLocal2026' npm run admin:create -- --email julia.teste@exemplo.com.br
 *   3. npm run build && npm start
 *   4. npm run test:e2e
 *
 * Variáveis opcionais: BASE_URL, E2E_EMAIL, E2E_PASSWORD, DB_URL.
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "julia.teste@exemplo.com.br";
const PASSWORD = process.env.E2E_PASSWORD ?? "TesteLocal2026";
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SLUG = "julia-santos-epil";
const SHOTS = "tests/e2e/screenshots";
mkdirSync(SHOTS, { recursive: true });

if (!/localhost|127\.0\.0\.1/.test(BASE)) {
  console.error("Por segurança, estes testes só rodam contra um ambiente local.");
  process.exit(1);
}

const results = [];
function record(id, name, ok, detail = "") {
  results.push({ id, name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${id} — ${name}${detail ? ` (${detail})` : ""}`);
}
async function step(id, name, fn) {
  try {
    const detail = await fn();
    record(id, name, true, detail ?? "");
  } catch (e) {
    record(id, name, false, e.message.split("\n")[0]);
  }
}
const sql = (q) => execFileSync("psql", [DB_URL, "-At", "-c", q], { encoding: "utf8" }).trim();
const stamp = Date.now().toString().slice(-5);
const SERVICE = `Serviço Teste ${stamp}`;

const browser = await chromium.launch();

// ---------------------------------------------------------------- ADMIN
const admin = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const ap = await admin.newPage();

await step("Acesso", "Três cliques na logomarca abrem /admin/login", async () => {
  await ap.goto(`${BASE}/`);
  const logo = ap.getByRole("button", { name: /voltar ao início/i });
  await logo.click();
  await logo.click();
  await logo.click();
  await ap.waitForURL("**/admin/login", { timeout: 5000 });
});

await step("Acesso", "Login real com e-mail e senha", async () => {
  await ap.goto(`${BASE}/admin/login`);
  await ap.fill("#email", EMAIL);
  await ap.fill("#password", PASSWORD);
  await ap.getByRole("button", { name: "Entrar" }).click();
  await ap.waitForURL(`${BASE}/admin`);
  await ap.getByText("Olá, Julia! ✨").waitFor();
  await ap.screenshot({ path: `${SHOTS}/admin-dashboard.png`, fullPage: true });
});

await step("TESTE 1", "Julia cadastra um serviço", async () => {
  await ap.goto(`${BASE}/admin/servicos`);
  await ap.getByRole("button", { name: /Novo serviço|Cadastrar primeiro serviço/ }).first().click();
  await ap.fill("#sv-name", SERVICE);
  await ap.fill("#sv-price", "85,00");
  await ap.fill("#sv-dur", "60");
  await ap.fill("#sv-desc", "Serviço criado pelo teste automatizado.");
  await ap.getByRole("button", { name: "Salvar serviço" }).click();
  await ap.getByText(SERVICE).first().waitFor();
  const n = sql(`select count(*) from services where name = '${SERVICE}' and price_cents = 8500 and duration_minutes = 60`);
  if (n !== "1") throw new Error("serviço não encontrado no banco");
  return "salvo no banco com R$ 85,00 e 60 min";
});

await step("TESTE 2", "Julia define dias e horários de funcionamento", async () => {
  await ap.goto(`${BASE}/admin/horarios`);
  for (const day of ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]) {
    const sw = ap.getByRole("switch", { name: `${day} aberto` });
    if ((await sw.getAttribute("aria-checked")) !== "true") await sw.click();
  }
  await ap.getByRole("checkbox", { name: "Almoço" }).first().check();
  await ap.getByRole("button", { name: /Copiar para todos/ }).first().click();
  await ap.getByRole("button", { name: "Salvar horários" }).click();
  await ap.getByText("Horários salvos.").waitFor();
  const n = sql(`select count(*) from working_hours w join businesses b on b.id=w.business_id where b.slug='${SLUG}' and w.is_open and w.open_time='09:00' and w.close_time='18:00' and w.break_start='12:00'`);
  if (n !== "7") throw new Error(`esperava 7 dias abertos, banco tem ${n}`);
  return "7 dias 09:00–18:00 com almoço 12:00–13:00";
});

// ---------------------------------------------------------------- CLIENTE (celular)
const iphone = devices["iPhone 13"];
async function bookingUntilReview(ctx, { name, phone, dayIndex = 0, slotIndex = 0 }) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/agendar/${SLUG}`);
  await p.getByRole("button", { name: new RegExp(SERVICE) }).click();
  const days = p.locator("[role=gridcell]:not([disabled])");
  await days.first().waitFor({ timeout: 15000 });
  await days.nth(dayIndex).click();
  const slots = p.locator("button[aria-pressed], button[aria-selected]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor({ timeout: 15000 });
  const time = (await slots.nth(slotIndex).textContent()).trim();
  await slots.nth(slotIndex).click();
  await p.fill("#fullName", name);
  await p.fill("#phone", phone);
  await p.fill("#email", `cliente.${phone.replace(/\D/g, "")}@exemplo.com.br`);
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  await p.getByRole("button", { name: "Confirmar agendamento" }).waitFor();
  const terms = p.getByTestId("terms-checkbox");
  await terms.check();
  await p.getByTestId("privacy-checkbox").check();
  return { p, time };
}

let reference = "";
let manageUrl = "";
const cliente = await browser.newContext({ ...iphone, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });

await step("TESTE 3", "Cliente acessa a página pública e vê os serviços", async () => {
  const p = await cliente.newPage();
  await p.goto(`${BASE}/`);
  await p.getByText(SERVICE).first().waitFor();
  await p.screenshot({ path: `${SHOTS}/mobile-home.png`, fullPage: false });
  await p.goto(`${BASE}/agendar/${SLUG}`);
  await p.getByRole("button", { name: new RegExp(SERVICE) }).waitFor();
  await p.screenshot({ path: `${SHOTS}/mobile-agendar-servicos.png` });
  await p.close();
});

let firstTime = "";
await step("TESTE 4/5", "Cliente escolhe data e horário livres e o agendamento é salvo no banco", async () => {
  const { p, time } = await bookingUntilReview(cliente, { name: "Maria Teste Silva", phone: "(31) 98888-0001" });
  firstTime = time;
  await p.screenshot({ path: `${SHOTS}/mobile-agendar-revisao.png`, fullPage: true });
  await p.getByRole("button", { name: "Confirmar agendamento" }).click();
  await p.getByText("Agendamento realizado com sucesso! ✨").waitFor();
  reference = (await p.getByTestId("booking-reference").textContent()).trim();
  manageUrl = await p.getByTestId("manage-link").getAttribute("href");
  await p.screenshot({ path: `${SHOTS}/mobile-agendar-sucesso.png`, fullPage: true });
  const row = sql(`select a.status || '|' || c.full_name from appointments a join clients c on c.id=a.client_id where a.reference_code='${reference}'`);
  if (!row.startsWith("pending|Maria Teste Silva")) throw new Error(`banco retornou: ${row}`);
  const ics = await cliente.request.get(`${BASE}/api/agendamento${manageUrl.replace("/agendamento", "")}/ics`);
  if (!(ics.headers()["content-type"] ?? "").includes("text/calendar")) throw new Error("ICS inválido");
  return `${reference} às ${time}, status pendente; arquivo .ics OK`;
});

await step("TESTE 6", "O agendamento aparece no painel administrativo", async () => {
  await ap.goto(`${BASE}/admin/agenda?view=lista`);
  await ap.getByText("Maria Teste Silva").first().waitFor();
  await ap.goto(`${BASE}/admin`);
  await ap.getByText("Maria Teste Silva").first().waitFor();
});

await step("TESTE 7", "Mesmo horário não pode ser reservado por outra cliente (inclusive simultaneamente)", async () => {
  // a) o horário já reservado some da lista
  const c2 = await browser.newContext({ ...iphone, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
  const p = await c2.newPage();
  await p.goto(`${BASE}/agendar/${SLUG}`);
  await p.getByRole("button", { name: new RegExp(SERVICE) }).click();
  await p.locator("[role=gridcell]:not([disabled])").first().click();
  const slots = p.locator("button[aria-pressed], button[aria-selected]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor();
  const times = (await slots.allTextContents()).map((t) => t.trim());
  if (times.includes(firstTime)) throw new Error(`horário ${firstTime} ainda aparece como livre`);
  await c2.close();

  // b) corrida: duas clientes confirmam o MESMO horário ao mesmo tempo
  const ca = await browser.newContext({ ...iphone, locale: "pt-BR" });
  const cb = await browser.newContext({ ...iphone, locale: "pt-BR" });
  const A = await bookingUntilReview(ca, { name: "Ana Corrida Teste", phone: "(31) 98888-0002", dayIndex: 1 });
  const B = await bookingUntilReview(cb, { name: "Bia Corrida Teste", phone: "(31) 98888-0003", dayIndex: 1 });
  if (A.time !== B.time) throw new Error("as duas clientes não estão no mesmo horário");
  await Promise.all([
    A.p.getByRole("button", { name: "Confirmar agendamento" }).click(),
    B.p.getByRole("button", { name: "Confirmar agendamento" }).click(),
  ]);
  const outcome = async (pg) =>
    Promise.race([
      pg.getByText("Agendamento realizado com sucesso! ✨").waitFor({ timeout: 15000 }).then(() => "ok"),
      pg.getByText(/acabou de ser reservado/).waitFor({ timeout: 15000 }).then(() => "recusado"),
    ]);
  const [ra, rb] = await Promise.all([outcome(A.p), outcome(B.p)]);
  const ok = [ra, rb].filter((r) => r === "ok").length;
  if (ok !== 1) throw new Error(`esperava 1 sucesso, obtive A=${ra} B=${rb}`);
  await (ra === "recusado" ? A.p : B.p).screenshot({ path: `${SHOTS}/mobile-horario-indisponivel.png`, fullPage: true });
  await ca.close();
  await cb.close();
  return `corrida simultânea: 1 aceita, 1 recusada com alternativas`;
});

await step("TESTE 8", "Julia cancela e reagenda atendimentos", async () => {
  const id = sql(`select id from appointments where reference_code='${reference}'`);
  // Reagendar pelo painel: escolhe outro horário livre do mesmo dia
  await ap.goto(`${BASE}/admin/agenda/${id}?editar=1`);
  const chips = ap.locator("button.rounded-full").filter({ hasText: /^\d{2}:\d{2}$/ });
  await chips.first().waitFor();
  const all = (await chips.allTextContents()).map((t) => t.trim());
  const target = all.find((t) => t !== firstTime && t >= "14:00") ?? all.find((t) => t !== firstTime);
  await chips.filter({ hasText: target }).first().click();
  await ap.getByRole("button", { name: "Salvar alterações" }).click();
  await ap.waitForURL(`**/admin/agenda/${id}`);
  await ap.getByText(new RegExp(`${target}–`)).waitFor();
  // Confirmar
  await ap.getByTestId("btn-confirmar").click();
  await ap.getByText("Agendamento confirmado.").waitFor();
  // Cancelar
  await ap.getByTestId("btn-cancelar").click();
  await ap.getByTestId("btn-confirmar-cancelamento").click();
  await ap.getByText("Agendamento cancelado.").waitFor();
  const st = sql(`select status || '|' || to_char(starts_at at time zone 'America/Sao_Paulo','HH24:MI') from appointments where id='${id}'`);
  if (st !== `cancelled|${target}`) throw new Error(`banco: ${st}`);
  // Cliente reagenda/cancela pelo link (com outra reserva)
  return `reagendado de ${firstTime} para ${target}, depois cancelado`;
});

await step("TESTE 8b", "Cliente reagenda e cancela pelo link seguro", async () => {
  const { p } = await bookingUntilReview(cliente, { name: "Maria Teste Silva", phone: "(31) 98888-0001", dayIndex: 2 });
  await p.getByRole("button", { name: "Confirmar agendamento" }).click();
  await p.getByText("Agendamento realizado com sucesso! ✨").waitFor();
  const ref = (await p.getByTestId("booking-reference").textContent()).trim();
  await p.getByTestId("manage-link").click();
  await p.getByText(ref, { exact: true }).first().waitFor();
  await p.getByRole("button", { name: "Reagendar" }).click();
  await p.locator("[role=gridcell]:not([disabled])").nth(3).click();
  const slots = p.locator("button[aria-pressed], button[aria-selected]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor();
  await slots.last().click();
  await p.getByRole("button", { name: /^Confirmar \d{2}\/\d{2}/ }).click();
  await p.getByText(/Reagendado para/).waitFor();
  await p.getByRole("button", { name: "Cancelar agendamento" }).click();
  await p.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await p.getByText("Cancelado").first().waitFor();
  const st = sql(`select status || '|' || reschedule_count || '|' || coalesce(cancelled_by,'') from appointments where reference_code='${ref}'`);
  if (st !== "cancelled|1|cliente") throw new Error(`banco: ${st}`);
  await p.screenshot({ path: `${SHOTS}/mobile-gerenciar-cancelado.png`, fullPage: true });
  return `${ref}: reagendado 1× e cancelado pela cliente`;
});

await step("TESTE 9", "Botão de WhatsApp abre a conversa com a mensagem personalizada", async () => {
  const id = sql(`select a.id from appointments a join clients c on c.id=a.client_id where c.full_name in ('Ana Corrida Teste','Bia Corrida Teste') and a.status='pending' order by a.created_at desc limit 1`);
  await ap.goto(`${BASE}/admin/agenda/${id}`);
  const href = await ap.getByTestId("wa-confirmacao").getAttribute("href");
  const url = new URL(href);
  const text = url.searchParams.get("text");
  if (url.hostname !== "wa.me" || !/^\/553198888000\d$/.test(url.pathname)) throw new Error(`link inesperado: ${href}`);
  if (!text.includes("Seu agendamento na Julia Santos Epil foi confirmado!") || !text.includes(`Serviço: ${SERVICE}`)) throw new Error("mensagem incompleta");
  const target = await ap.getByTestId("wa-confirmacao").getAttribute("target");
  if (target !== "_blank") throw new Error("deveria abrir em nova aba");
  return `${url.origin}${url.pathname} + mensagem de confirmação preenchida`;
});

await step("TESTE 11", "Usuários não autorizados não acessam o painel", async () => {
  const anon = await browser.newContext();
  const p = await anon.newPage();
  for (const path of ["/admin", "/admin/agenda", "/admin/clientes", "/admin/configuracoes", "/admin/exportar/clientes.csv"]) {
    await p.goto(`${BASE}${path}`);
    if (!p.url().includes("/admin/login")) throw new Error(`${path} não redirecionou para o login`);
  }
  // Conta válida, mas sem vínculo com a empresa
  execFileSync("node", ["--env-file=.env.local", "-e", `
    const { createClient } = require("@supabase/supabase-js");
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
    db.auth.admin.createUser({ email: "intrusa-${stamp}@exemplo.com.br", password: "Intrusa12345", email_confirm: true }).then(r => { if (r.error) process.exit(1) });
  `]);
  await p.goto(`${BASE}/admin/login`);
  await p.fill("#email", `intrusa-${stamp}@exemplo.com.br`);
  await p.fill("#password", "Intrusa12345");
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.getByText("Esta conta não tem acesso ao painel.").waitFor();
  await p.goto(`${BASE}/admin`);
  if (!p.url().includes("/admin/login")) throw new Error("conta sem vínculo acessou o painel");
  // API pública sem chave não lê dados
  const r = await anon.request.get(`http://127.0.0.1:54321/rest/v1/clients?select=*`, {
    headers: { apikey: execFileSync("node", ["--env-file=.env.local", "-p", "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"], { encoding: "utf8" }).trim() },
  });
  const body = await r.text();
  if (r.ok() && body !== "[]") throw new Error("API anônima retornou clientes");
  await anon.close();
  return "redireciona ao login; conta sem vínculo recusada; API anônima sem acesso";
});

await step("TESTE 12", "Funciona em computador e smartphone (sem rolagem horizontal)", async () => {
  const checks = [];
  for (const [label, ctxOpts] of [
    ["celular", { ...iphone }],
    ["computador", { viewport: { width: 1440, height: 900 } }],
  ]) {
    const c = await browser.newContext(ctxOpts);
    await c.addCookies(await admin.cookies());
    const p = await c.newPage();
    for (const path of ["/", `/agendar/${SLUG}`, "/admin", "/admin/agenda", "/admin/agenda?view=semana", "/admin/agenda?view=mes", "/admin/clientes", "/admin/servicos", "/admin/horarios", "/admin/agendamento-online", "/admin/configuracoes"]) {
      await p.goto(`${BASE}${path}`);
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) checks.push(`${label} ${path}: +${overflow}px`);
      if (label === "celular" && ["/admin", "/admin/agenda"].includes(path)) {
        await p.screenshot({ path: `${SHOTS}/mobile${path.replaceAll("/", "-")}.png` });
      }
    }
    await c.close();
  }
  if (checks.length) throw new Error(checks.join("; "));
  return "11 páginas × 2 tamanhos de tela";
});

await step("TESTE 14", "Isolamento entre empresas (RLS) — testes SQL", async () => {
  const out = execFileSync("psql", [DB_URL, "-q", "-v", "ON_ERROR_STOP=1", "-f", "supabase/tests/booking_rules.test.sql"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return "regras de agenda + RLS aprovados";
});

await browser.close();

console.log("\nPendentes de configuração externa (não simulados):");
console.log("  TESTE 10 — Google Agenda: integração prevista para a Fase 2.");
console.log("  TESTE 13 — Link público fora do ambiente de desenvolvimento: depende da publicação.");
const failed = results.filter((r) => !r.ok);
console.log(`\nResultado: ${results.length - failed.length}/${results.length} aprovados.`);
process.exit(failed.length ? 1 : 0);
