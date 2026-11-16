"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { passwordSchema } from "@/lib/schemas";
import { AREAS, type Permissions } from "@/lib/permissions";
import { friendlyDbError } from "@/lib/constants";
import { zodFieldErrors, type ActionResult } from "@/lib/action";

/**
 * Gestão de usuários do painel — exclusiva do administrador geral.
 * Senhas são definidas direto no Auth (nunca ficam salvas nem aparecem no sistema).
 */

async function isMember(businessId: string, userId: string) {
  const { data } = await createServiceClient().from("business_members").select("user_id").eq("business_id", businessId).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

const newUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")),
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "As senhas não conferem", path: ["confirm"] });

export async function createPanelUserAction(input: z.input<typeof newUserSchema>): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ platformAdmin: true });
    const parsed = newUserSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(parsed.error.issues) };
    const { email, password } = parsed.data;
    const db = createServiceClient();

    let userId: string | null = null;
    const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.data.user) userId = created.data.user.id;
    else {
      // E-mail já cadastrado no Auth: localiza e só vincula ao painel (a senha atual é mantida).
      for (let page = 1; page <= 20 && !userId; page++) {
        const { data } = await db.auth.admin.listUsers({ page, perPage: 200 });
        userId = data?.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
        if (!data || data.users.length < 200) break;
      }
      if (!userId) return { ok: false, error: created.error?.message ?? "Não foi possível criar o login." };
    }
    if (await isMember(ctx.business.id, userId)) return { ok: false, error: "Este e-mail já tem acesso ao painel." };
    const { error } = await db.from("business_members").insert({ business_id: ctx.business.id, user_id: userId, role: "owner", permissions: {} });
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    revalidatePath("/admin/usuarios");
    return {
      ok: true,
      message: created.data.user ? "Login criado. Repasse a senha para a pessoa por um canal seguro." : "E-mail já existia: acesso ao painel liberado com a senha atual dele.",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

const passwordChangeSchema = z
  .object({ userId: z.uuid(), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "As senhas não conferem", path: ["confirm"] });

export async function setUserPasswordAction(input: z.input<typeof passwordChangeSchema>): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ platformAdmin: true });
    const parsed = passwordChangeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Confira os campos.", fieldErrors: zodFieldErrors(parsed.error.issues) };
    if (!(await isMember(ctx.business.id, parsed.data.userId))) return { ok: false, error: "Usuário não encontrado neste painel." };
    const { error } = await createServiceClient().auth.admin.updateUserById(parsed.data.userId, { password: parsed.data.password });
    if (error) return { ok: false, error: "Não foi possível alterar a senha. Tente outra senha." };
    return { ok: true, message: "Senha alterada. Repasse a nova senha por um canal seguro." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}

const areaKeys = AREAS.map((a) => a.key) as [string, ...string[]];
const permissionsSchema = z.object({
  userId: z.uuid(),
  permissions: z.record(z.enum(areaKeys), z.boolean()),
});

export async function setPermissionsAction(input: z.input<typeof permissionsSchema>): Promise<ActionResult> {
  try {
    const ctx = await assertAdmin({ platformAdmin: true });
    const parsed = permissionsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Permissões inválidas." };
    const { userId, permissions } = parsed.data;
    if (userId === ctx.userId) return { ok: false, error: "O administrador geral sempre tem acesso total." };
    const db = createServiceClient();
    const { data: profile } = await db.from("profiles").select("is_platform_admin").eq("id", userId).maybeSingle();
    if (profile?.is_platform_admin) return { ok: false, error: "Este usuário é administrador geral e tem acesso total." };
    // Guarda só as áreas bloqueadas (ausente = liberada).
    const blocked: Permissions = {};
    for (const [k, v] of Object.entries(permissions)) if (v === false) blocked[k as keyof Permissions] = false;
    const { data, error } = await ctx.supabase
      .from("business_members")
      .update({ permissions: blocked })
      .eq("business_id", ctx.business.id)
      .eq("user_id", userId)
      .select("user_id");
    if (error) return { ok: false, error: friendlyDbError(error.message) };
    if (!data?.length) return { ok: false, error: "Usuário não encontrado neste painel." };
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Permissões salvas." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro." };
  }
}
