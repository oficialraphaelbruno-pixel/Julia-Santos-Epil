/**
 * Ofertas (order bump), bloqueio de cliente, foto da cliente e aniversariantes (ambiente LOCAL).
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
const biz = sql(`select id from businesses where slug='julia-santos-epil'`);
sql(`insert into services (business_id, name, price_cents, duration_minutes) values
     ('${biz}', 'Nariz ${stamp}', 4000, 30), ('${biz}', 'Buco ${stamp}', 2500, 30)`);
const nariz = sql(`select id from services where name='Nariz ${stamp}'`);

const browser = await chromium.launch();
const admin = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const ap = await admin.newPage();
await ap.goto(`${BASE}/admin/login`);
await ap.fill("#email", EMAIL);
await ap.fill("#password", PASSWORD);
await ap.getByRole("button", { name: "Entrar" }).click();
await ap.waitForURL(`${BASE}/admin`);

await step("O1", "Julia cria a oferta: quem agenda Nariz vê Buço por preço especial", async () => {
  await ap.goto(`${BASE}/admin/servicos`);
  await ap.getByTestId("nova-oferta").click();
  await ap.selectOption("#of-main", { label: `Nariz ${stamp} — R$ 40,00` });
  await ap.selectOption("#of-extra", { label: `Buco ${stamp} — R$ 25,00 (30 min)` });
  await ap.fill("#of-price", "15,00");
  await ap.getByText("a cliente economiza R$ 10,00").waitFor();
  await ap.getByTestId("salvar-oferta").click();
  await ap.getByText("Oferta criada.").waitFor();
  await ap.getByTestId(`oferta-Buco ${stamp}`).waitFor();
  const row = sql(`select offer_price_cents || '|' || active from service_offers where service_id='${nariz}'`);
  if (row !== "1500|true") throw new Error(`banco: ${row}`);
  await ap.getByTestId("offers-manager").screenshot({ path: "tests/e2e/screenshots/ofertas-painel.png" });
  return "R$ 25,00 → R$ 15,00";
});

const phone = `3196${stamp}88`.slice(0, 11);
const clientEmail = `oferta${stamp}@exemplo.com.br`;
await step("O2", "Cliente agenda Nariz e adiciona a oferta: valor e duração somados", async () => {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/agendar/julia-santos-epil?servico=${nariz}`);
  const offer = p.getByTestId("offers");
  await offer.getByText("economize R$ 10,00").waitFor();
  await offer.locator("input[type=checkbox]").check();
  await p.screenshot({ path: "tests/e2e/screenshots/oferta-cliente.png" });
  await p.locator("[role=gridcell]:not([disabled])").nth(4).click();
  const slots = p.locator("button[aria-pressed]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor();
  await slots.first().click();
  await p.fill("#fullName", "Cliente Oferta Teste");
  await p.fill("#phone", `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`);
  await p.fill("#email", clientEmail);
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  await p.getByText(`Nariz ${stamp} + Buco ${stamp}`).first().waitFor();
  await p.getByText("R$ 55,00").first().waitFor();
  await p.getByTestId("terms-checkbox").check();
  await p.getByTestId("privacy-checkbox").check();
  await p.getByTestId("confirm-booking").click();
  await p.getByText("Agendamento realizado com sucesso! ✨").waitFor({ timeout: 20000 });
  const row = sql(`select price_cents || '|' || duration_minutes || '|' || (extract(epoch from (ends_at - starts_at))/60)::int || '|' || service_name from appointments a join clients c on c.id=a.client_id where c.phone='55${phone}' order by a.created_at desc limit 1`);
  if (row !== `5500|60|60|Nariz ${stamp} + Buco ${stamp}`) throw new Error(`banco: ${row}`);
  await ctx.close();
  return "R$ 40 + R$ 15 = R$ 55; 30 + 30 = 60 min";
});

await step("B1", "Julia bloqueia a cliente; ela não consegue agendar pelo site (nem com outro número)", async () => {
  const clientId = sql(`select id from clients where phone='55${phone}'`);
  await ap.goto(`${BASE}/admin/clientes/${clientId}`);
  await ap.getByTestId("bloquear-cliente").click();
  await ap.getByTestId("bloqueio-motivo").fill("Faltou duas vezes sem avisar");
  await ap.getByTestId("bloqueio-confirmar").click();
  await ap.getByTestId("cliente-bloqueada").getByText("Faltou duas vezes sem avisar").waitFor();
  await ap.goto(`${BASE}/admin/clientes?filtro=bloqueadas`);
  await ap.locator(`a[href='/admin/clientes/${clientId}']`).waitFor();

  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/agendar/julia-santos-epil?servico=${nariz}`);
  await p.locator("[role=gridcell]:not([disabled])").nth(6).click();
  const slots = p.locator("button[aria-pressed]").filter({ hasText: /^\d{2}:\d{2}$/ });
  await slots.first().waitFor();
  await slots.first().click();
  await p.fill("#fullName", "Outro Nome Qualquer");
  await p.fill("#phone", "(31) 97777-1234");
  await p.fill("#email", clientEmail.toUpperCase());
  await p.getByRole("button", { name: "Revisar agendamento" }).click();
  await p.getByTestId("terms-checkbox").check();
  await p.getByTestId("privacy-checkbox").check();
  await p.getByTestId("confirm-booking").click();
  await p.getByText("Não foi possível concluir o agendamento online").waitFor({ timeout: 15000 });
  await ctx.close();

  await ap.goto(`${BASE}/admin/clientes/${clientId}`);
  await ap.getByTestId("desbloquear-cliente").click();
  await ap.getByText("Cliente desbloqueada.").waitFor();
  if (sql(`select blocked_at is null from clients where id='${clientId}'`) !== "t") throw new Error("não desbloqueou");
  return "bloqueio por e-mail funcionou; desbloqueio ok";
});

await step("F1", "Foto da cliente: envia, aparece na ficha e na lista, e é removida", async () => {
  const clientId = sql(`select id from clients where phone='55${phone}'`);
  await ap.goto(`${BASE}/admin/clientes/${clientId}`);
  // PNG 2x2 válido
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVQI12P8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==", "base64");
  await ap.getByTestId("client-photo-input").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await ap.getByText("Foto salva.").waitFor();
  await ap.getByTestId("client-photo").waitFor();
  const path = sql(`select photo_path from clients where id='${clientId}'`);
  if (!path.startsWith(`${biz}/${clientId}-`)) throw new Error(`caminho: ${path}`);
  const src = await ap.getByTestId("client-photo").getAttribute("src");
  if (!src.includes("token=")) throw new Error("foto sem link temporário");
  const pub = await ap.request.get(`http://127.0.0.1:54321/storage/v1/object/public/client-photos/${path}`);
  if (pub.ok()) throw new Error("foto acessível publicamente");
  await ap.goto(`${BASE}/admin/clientes?q=Cliente%20Oferta`);
  if ((await ap.locator(`a[href='/admin/clientes/${clientId}'] img`).count()) !== 1) throw new Error("miniatura não aparece na lista");
  await ap.goto(`${BASE}/admin/clientes/${clientId}`);
  ap.once("dialog", (d) => d.accept());
  await ap.getByRole("button", { name: "Remover foto" }).click();
  await ap.getByText("Foto removida.").waitFor();
  if (sql(`select coalesce(photo_path,'') from clients where id='${clientId}'`) !== "") throw new Error("foto não removida no banco");
  return "privada (link temporário), lista e remoção ok";
});

await step("N1", "Aniversariantes: card no painel com botão de parabéns e filtro na lista", async () => {
  const today = sql(`select to_char(now() at time zone 'America/Sao_Paulo', 'MM-DD')`);
  const clientId = sql(`select id from clients where phone='55${phone}'`);
  sql(`update clients set birthday = '1995-${today}' where id='${clientId}'`);
  await ap.goto(`${BASE}/admin`);
  const card = ap.getByTestId("birthdays");
  await card.getByText("Cliente Oferta Teste").first().waitFor();
  await card.getByText("Hoje! 🎉").first().waitFor();
  const href = await card.getByRole("link", { name: "Parabéns pelo WhatsApp" }).first().getAttribute("href");
  if (!href.startsWith("https://wa.me/")) throw new Error(`link: ${href}`);
  await card.screenshot({ path: "tests/e2e/screenshots/aniversariantes.png" });
  await ap.goto(`${BASE}/admin/clientes?filtro=aniversariantes`);
  await ap.locator(`a[href='/admin/clientes/${clientId}']`).waitFor();
  await ap.goto(`${BASE}/admin/clientes/${clientId}`);
  await ap.getByTestId("cliente-aniversario").getByText("Hoje! 🎉").waitFor();
  return "card, filtro e ficha";
});

await browser.close();
const ok = results.filter(Boolean).length;
console.log(`\nOfertas, bloqueio, foto e aniversário: ${ok}/${results.length} aprovados.`);
process.exit(ok === results.length ? 0 : 1);
