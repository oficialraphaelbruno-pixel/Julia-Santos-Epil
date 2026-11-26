import "server-only";

/**
 * Gasto real da organização na OpenAI (opcional).
 * Usa a API de custos da OpenAI, que exige uma chave de ADMINISTRADOR (sk-admin-...)
 * cadastrada na Vercel como OPENAI_ADMIN_KEY. Sem ela, o painel usa a estimativa
 * calculada com o consumo registrado de cada mensagem da assistente.
 * Observação: a OpenAI não oferece uma API oficial com o saldo da carteira.
 */
export function adminKeyConfigured() {
  return Boolean(process.env.OPENAI_ADMIN_KEY?.trim());
}

export async function fetchOrgCostsUsd(
  sinceUnix: number,
): Promise<{ ok: true; totalUsd: number } | { ok: false; error: string }> {
  const key = process.env.OPENAI_ADMIN_KEY?.trim();
  if (!key) return { ok: false, error: "sem chave de administrador" };
  const base = (
    process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  let total = 0;
  let page: string | null = null;
  try {
    for (let i = 0; i < 12; i++) {
      const url = new URL(`${base}/organization/costs`);
      url.searchParams.set("start_time", String(Math.floor(sinceUnix)));
      url.searchParams.set("bucket_width", "1d");
      url.searchParams.set("limit", "180");
      if (page) url.searchParams.set("page", page);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
        cache: "no-store",
      }).finally(() => clearTimeout(timer));
      if (!res.ok) {
        console.error(`[openai-billing] custos responderam ${res.status}`);
        return {
          ok: false,
          error:
            res.status === 401 || res.status === 403
              ? "chave de administrador recusada"
              : `OpenAI respondeu ${res.status}`,
        };
      }
      const body = (await res.json()) as {
        data?: { results?: { amount?: { value?: number | string } }[] }[];
        has_more?: boolean;
        next_page?: string | null;
      };
      for (const bucket of body.data ?? [])
        for (const r of bucket.results ?? [])
          total += Number(r.amount?.value ?? 0) || 0;
      if (!body.has_more || !body.next_page) break;
      page = body.next_page;
    }
    return { ok: true, totalUsd: Math.round(total * 10000) / 10000 };
  } catch (e) {
    console.error(
      "[openai-billing] falha:",
      e instanceof Error ? e.message : e,
    );
    return { ok: false, error: "não foi possível consultar a OpenAI agora" };
  }
}
