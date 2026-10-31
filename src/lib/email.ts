import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { SITE_URL } from "@/lib/env";

export function emailConfig() {
  const host = process.env.SMTP_HOST ?? "";
  const from = process.env.EMAIL_FROM ?? "";
  const missing = [!host && "SMTP_HOST", !from && "EMAIL_FROM"].filter(Boolean) as string[];
  return {
    configured: missing.length === 0,
    missing,
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from,
  };
}

let transporter: Transporter | null = null;
function getTransport() {
  const c = emailConfig();
  if (!c.configured) return null;
  transporter ??= nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: c.user ? { user: c.user, pass: c.pass } : undefined,
  });
  return transporter;
}

export async function sendEmail(opts: { to: string; subject: string; html: string; text: string; replyTo?: string | null; fromName?: string }) {
  const t = getTransport();
  if (!t) return { ok: false as const, skipped: true, error: "E-mail não configurado" };
  const c = emailConfig();
  const from = opts.fromName && !c.from.includes("<") ? `"${opts.fromName.replace(/"/g, "")}" <${c.from}>` : c.from;
  try {
    const info = await t.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text, replyTo: opts.replyTo ?? undefined });
    return { ok: true as const, id: info.messageId as string };
  } catch (e) {
    return { ok: false as const, skipped: false, error: e instanceof Error ? e.message : "Falha no envio" };
  }
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** E-mail transacional com a identidade visual (marfim + dourado + logomarca). */
export function renderEmailHtml(opts: {
  businessName: string;
  logoUrl: string | null;
  title: string;
  message: string;
  details: [string, string][];
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}) {
  const logo = opts.logoUrl ? (opts.logoUrl.startsWith("http") ? opts.logoUrl : `${SITE_URL}${opts.logoUrl}`) : null;
  const rows = opts.details
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;color:#717171;font-size:14px">${esc(k)}</td><td style="padding:6px 0;color:#252525;font-size:14px;font-weight:600;text-align:right">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;background:#FAF7F2;font-family:Arial,Helvetica,sans-serif;color:#252525">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #EADFCD;border-radius:20px;overflow:hidden">
<tr><td style="height:4px;background:linear-gradient(90deg,#C9A35F,#B68D40,#92702E)"></td></tr>
<tr><td align="center" style="padding:28px 28px 8px">${
    logo ? `<img src="${esc(logo)}" alt="${esc(opts.businessName)}" width="140" style="display:block;width:140px;max-width:60%;height:auto">` : `<div style="font-family:Georgia,serif;font-size:22px;color:#92702E">${esc(opts.businessName)}</div>`
  }</td></tr>
<tr><td style="padding:8px 32px 0;text-align:center"><h1 style="font-family:Georgia,'Playfair Display',serif;font-weight:400;font-size:24px;margin:12px 0 8px;color:#252525">${esc(opts.title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.6;color:#555;white-space:pre-line">${esc(opts.message)}</p></td></tr>
<tr><td style="padding:20px 32px"><table role="presentation" width="100%" style="border-top:1px solid #EADFCD;border-bottom:1px solid #EADFCD;padding:8px 0">${rows}</table></td></tr>
${
  opts.ctaUrl
    ? `<tr><td align="center" style="padding:0 32px 28px"><a href="${esc(opts.ctaUrl)}" style="display:inline-block;background:#B68D40;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:999px">${esc(opts.ctaLabel ?? "Ver agendamento")}</a></td></tr>`
    : ""
}
<tr><td style="padding:16px 32px 24px;text-align:center;font-size:12px;color:#999;border-top:1px solid #F4EEE4">${esc(opts.footer ?? opts.businessName)}</td></tr>
</table></td></tr></table></body></html>`;
}
