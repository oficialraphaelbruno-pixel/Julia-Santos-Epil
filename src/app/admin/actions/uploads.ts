"use server";

import { randomUUID } from "node:crypto";
import { assertAdmin } from "@/lib/auth";
import type { ActionResult } from "@/lib/action";

const ALLOWED = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
const MAX_BYTES = 5 * 1024 * 1024;

/** Envia uma imagem para o Storage da empresa (pasta = id da empresa). */
export async function uploadImageAction(formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    const ctx = await assertAdmin({ owner: true });
    const file = formData.get("file");
    const kind = String(formData.get("kind") ?? "imagem").replace(/[^a-z-]/g, "").slice(0, 20) || "imagem";
    if (!(file instanceof File)) return { ok: false, error: "Selecione uma imagem." };
    const ext = ALLOWED[file.type as keyof typeof ALLOWED];
    if (!ext) return { ok: false, error: "Formato não suportado. Use PNG, JPG ou WEBP." };
    if (file.size > MAX_BYTES) return { ok: false, error: "A imagem deve ter no máximo 5 MB." };

    const path = `${ctx.business.id}/${kind}-${randomUUID()}.${ext}`;
    const { error } = await ctx.supabase.storage.from("business-assets").upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) return { ok: false, error: "Falha ao enviar a imagem." };
    const { data } = ctx.supabase.storage.from("business-assets").getPublicUrl(path);
    return { ok: true, data: { url: data.publicUrl } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao enviar a imagem." };
  }
}
