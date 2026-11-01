/**
 * Testes de ponta a ponta da Fase 2 (ambiente LOCAL, após `npm run test:e2e`).
 * E-mails são entregues de verdade ao servidor SMTP local (Mailpit) e lidos pela API dele.
 * Google Agenda NÃO é testado aqui contra o Google real (exige credenciais OAuth);
 * a lógica é coberta por testes unitários com respostas simuladas (identificados como tal).
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MAILPIT = "http://127.0.0.1:54324";
const EMAIL = process.env.E2E_EMAIL ?? "julia.teste@exemplo.com.br";
const PASSWORD = process.env.E2E_PASSWORD ?? "TesteLocal2026";
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SLUG = "julia-santos-epil";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (!/localhost|127\.0\.0\.1/.test(BASE)) process.exit(1);

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
const sql = (q) => execFileSync("psql", [DB_URL, "-At", "-c", q], { encoding: "utf8" }).trim();
const mails = async (to) => {
  const r = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
  return r.messages ?? [];
};
const waitMail = async (to, subjectPart, timeout = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const m = (await mails(to)).find((x) => (subjectPart instanceof RegExp ? subjectPart.test(x.Subject) : x.Subject.includes(subjectPart)));
    if (m) return m;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`e-mail "${subjectPart}" não chegou para ${to}`);
};
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0");
}

const stamp = Date.now().toString().slice(-5);
const clientEmail = `cliente${stamp}@exemplo.com.br`;
const browser = await chromium.launch();
const admin = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const ap = await admin.newPage();
await ap.goto(`${BASE}/admin/login`);
await ap.fill("#email", EMAIL);
await ap.fill("#password", PASSWORD);
await ap.getByRole("button", { name: "Entrar" }).click();
await ap.waitForURL(`${BASE}/admin`);

const service = sql(`select name from services where status='active' and show_online order by created_at desc limit 1`);
let manageHref = "";
let reference = "";

await step("F2.1", "Agendamento online envia e-mail real com link de gerenciamento", async () => {
  const c = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await c.newPage();
  await p.goto(`${BASE}/agendar/${SLUG}`);
  await p.getByRole("button", { name: new RegExp(service) }).click();
  await p.locator("[role=gridcell]:not([disabled])").nth(4).click();
  const slots = p.locator("button[aria-pressed]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor();
  await slots.nth(2).click();
  await p.fill("#fullName", "Carla Email Teste");
  await p.fill("#phone", `(31) 97777-${stamp.slice(0, 4)}`);
  await p.fill("#email", clientEmail);
  await p.locator("input[name=privacy]").check();
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  const terms = p.getByTestId("terms-checkbox");
  if (await terms.count()) await terms.check();
  await p.getByRole("button", { name: "Confirmar agendamento" }).click();
  await p.getByText("Agendamento realizado com sucesso! ✨").waitFor();
  reference = (await p.getByTestId("booking-reference").textContent()).trim();
  manageHref = await p.getByTestId("manage-link").getAttribute("href");
  const m = await waitMail(clientEmail, /Recebemos seu agendamento|falta o sinal/);
  const full = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json();
  if (!full.HTML.includes(reference)) throw new Error("referência ausente no e-mail");
  if (!full.HTML.includes(manageHref)) throw new Error("link de gerenciamento ausente");
  if (!full.HTML.includes("julia-santos-logo.png")) throw new Error("logomarca ausente");
  const log = sql(`select status from message_logs where recipient='${clientEmail}' and template in ('recebido','sinal')`);
  if (log !== "sent") throw new Error(`registro: ${log}`);
  await c.close();
  return `${reference}: "${m.Subject}"`;
});

await step("F2.2", "Confirmar no painel envia e-mail de confirmação (sem duplicar)", async () => {
  const id = sql(`select id from appointments where reference_code='${reference}'`);
  await ap.goto(`${BASE}/admin/agenda/${id}`);
  if (await ap.getByTestId("btn-sinal-recebido").count()) {
    await ap.getByTestId("btn-sinal-recebido").click();
    await ap.getByText("Sinal registrado e agendamento confirmado.").waitFor();
  } else {
    await ap.getByTestId("btn-confirmar").click();
    await ap.getByText("Agendamento confirmado.").waitFor();
  }
  await waitMail(clientEmail, "Agendamento confirmado");
  await ap.reload();
  await ap.getByText(/E-mail \(confirmacao\) — enviado/).waitFor();
  const n = sql(`select count(*) from message_logs where recipient='${clientEmail}' and status='sent'`);
  if (n !== "2") throw new Error(`esperava 2 e-mails, há ${n}`);
  return "histórico do agendamento mostra o envio";
});

await step("F2.3", "Modelos editáveis são usados no WhatsApp", async () => {
  await ap.goto(`${BASE}/admin/comunicacao`);
  await ap.getByRole("button", { name: "Confirmação", exact: true }).click();
  const area = ap.getByLabel("Modelo: Confirmação");
  await area.fill("Oi {nome}! Seu horário de {servico} está confirmado para {data} às {horario}. Beijos, {empresa} 💛");
  await ap.getByText(/Oi Maria! Seu horário de Epilação/).waitFor();
  await ap.getByRole("button", { name: "Salvar comunicação" }).click();
  await ap.getByText("Comunicação salva.").waitFor();
  const id = sql(`select id from appointments where reference_code='${reference}'`);
  await ap.goto(`${BASE}/admin/agenda/${id}`);
  const href = await ap.getByTestId("wa-confirmacao").getAttribute("href");
  const text = new URL(href).searchParams.get("text");
  if (!text.startsWith("Oi Carla! Seu horário de")) throw new Error(`texto: ${text}`);
  // restaura o padrão
  await ap.goto(`${BASE}/admin/comunicacao`);
  await ap.getByRole("button", { name: "Confirmação", exact: true }).click();
  await ap.getByRole("button", { name: /Restaurar texto padrão/ }).click();
  await ap.getByRole("button", { name: "Salvar comunicação" }).click();
  await ap.getByText("Comunicação salva.").waitFor();
  return "texto personalizado aplicado e restaurado";
});

await step("F2.4", "Lembretes automáticos: protegido por segredo, envia véspera, sem duplicar", async () => {
  // agendamento para amanhã com e-mail
  const tomorrow = sql(`select ((now() at time zone 'America/Sao_Paulo')::date + 1)::text`);
  const cid = sql(`insert into clients (business_id, full_name, phone, email) select id, 'Rita Lembrete', '553196666${stamp.slice(0, 4)}', 'rita${stamp}@exemplo.com.br' from businesses where slug='${SLUG}' returning id`).split("\n")[0];
  sql(`insert into appointments (business_id, professional_id, service_id, client_id, starts_at, ends_at, status, reference_code, service_name, price_cents, duration_minutes)
       select b.id, p.id, null, '${cid}', ('${tomorrow} 07:00'::timestamp at time zone 'America/Sao_Paulo'), ('${tomorrow} 07:30'::timestamp at time zone 'America/Sao_Paulo'), 'confirmed', 'AG-L${stamp}', 'Lembrete Teste', 5000, 30
       from businesses b join professionals p on p.business_id=b.id where b.slug='${SLUG}' limit 1`);
  const noAuth = await fetch(`${BASE}/api/cron/lembretes`);
  if (noAuth.status !== 401) throw new Error("rota de lembretes aberta sem segredo");
  const r1 = await (await fetch(`${BASE}/api/cron/lembretes`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } })).json();
  await waitMail(`rita${stamp}@exemplo.com.br`, "Lembrete do seu atendimento");
  await fetch(`${BASE}/api/cron/lembretes`, { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
  await new Promise((r) => setTimeout(r, 1500));
  const n = (await mails(`rita${stamp}@exemplo.com.br`)).length;
  if (n !== 1) throw new Error(`esperava 1 lembrete, chegaram ${n}`);
  return `401 sem segredo; ${r1.verificados.vespera} verificado(s); 1 e-mail após 2 execuções`;
});

await step("F2.5", "Cancelamento pela cliente envia e-mail de cancelamento", async () => {
  const c = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await c.newPage();
  // regras: libera cancelamento a qualquer momento para o teste
  sql(`update booking_settings set cancel_min_hours=0`);
  await p.goto(`${BASE}${manageHref}`);
  await p.getByRole("button", { name: "Cancelar agendamento" }).click();
  await p.getByRole("button", { name: "Confirmar cancelamento" }).click();
  await waitMail(clientEmail, "Agendamento cancelado");
  sql(`update booking_settings set cancel_min_hours=24`);
  await c.close();
});

await step("F2.6", "Integrações exibem o estado real (sem simular conexão)", async () => {
  await ap.goto(`${BASE}/admin/integracoes`);
  await ap.getByText(/Credenciais pendentes no servidor: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET/).waitFor();
  await ap.getByText(/Servidor configurado · remetente/).waitFor();
  await ap.getByText(/API oficial não configurada/).waitFor();
  const r = await admin.request.get(`${BASE}/api/integracoes/google/conectar`, { maxRedirects: 0 });
  if (!(r.headers().location ?? "").includes("google=nao-configurado")) throw new Error("conectar deveria recusar sem credenciais");
  const anon = await fetch(`${BASE}/api/integracoes/google/callback?code=x&state=y`, { redirect: "manual" });
  if (!(anon.headers.get("location") ?? "").includes("/admin/login")) throw new Error("callback aceitou visitante anônimo");
  await ap.getByRole("button", { name: "Enviar teste" }).click();
  await waitMail(EMAIL, "Teste de e-mail");
  return "Google: pendente de credenciais; e-mail de teste entregue";
});

await step("F2.7", "Verificação em duas etapas (TOTP) protege o login", async () => {
  await ap.goto(`${BASE}/admin/configuracoes#seguranca`);
  await ap.getByRole("button", { name: "Ativar" }).first().click();
  const secret = (await ap.locator("code").filter({ hasText: /^[A-Z2-7]{16,}$/ }).first().textContent()).trim();
  await ap.getByLabel("Código").fill(totp(secret));
  await ap.getByRole("button", { name: "Ativar" }).click();
  await ap.getByText(/Ativada — o login pede o código/).waitFor();
  // novo login exige código
  const c = await browser.newContext();
  const p = await c.newPage();
  await p.goto(`${BASE}/admin/login`);
  await p.fill("#email", EMAIL);
  await p.fill("#password", PASSWORD);
  await p.getByRole("button", { name: "Entrar" }).click();
  await p.waitForURL("**/admin/verificacao");
  await p.goto(`${BASE}/admin/clientes`);
  if (!p.url().includes("/admin/verificacao")) throw new Error("painel acessível sem o segundo fator");
  await p.fill("#code", "000000");
  await p.getByRole("button", { name: "Verificar" }).click();
  await p.getByText("Código inválido").waitFor();
  await p.fill("#code", totp(secret));
  await p.getByRole("button", { name: "Verificar" }).click();
  await p.waitForURL(`${BASE}/admin`);
  await p.getByText("Olá, Julia! ✨").waitFor();
  // desativa para não afetar os demais testes
  sql(`delete from auth.mfa_factors where user_id = (select id from auth.users where email='${EMAIL}')`);
  await c.close();
  return "sem código → bloqueado; código errado recusado; correto libera";
});

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\nFase 2: ${ok}/${results.length} aprovados.`);
process.exit(ok === results.length ? 0 : 1);
