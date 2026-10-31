import { z } from "zod";
import { normalizeBrazilPhone } from "@/lib/phone";

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido");
export const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60);

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Informe o WhatsApp")
  .transform((v, ctx) => {
    const n = normalizeBrazilPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "WhatsApp inválido. Use DDD + número, ex.: (31) 99999-9999" });
      return z.NEVER;
    }
    return n;
  });

export const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .optional()
  .transform((v) => (v ? v.toLowerCase() : ""))
  .refine((v) => !v || z.email().safeParse(v).success, "E-mail inválido");

export const clientBookingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo")
    .max(120)
    .refine((v) => v.split(/\s+/).length >= 2, "Informe nome e sobrenome"),
  phone: phoneSchema,
  email: optionalEmail,
  message: z.string().trim().max(500, "Máximo de 500 caracteres").optional().default(""),
  privacy: z.literal(true, { error: "É necessário aceitar a Política de Privacidade" }),
  marketing: z.boolean().optional().default(false),
  website: z.string().max(0).optional(), // honeypot anti-robôs
});
export type ClientBookingInput = z.input<typeof clientBookingSchema>;

export const passwordSchema = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres")
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letras e números");
