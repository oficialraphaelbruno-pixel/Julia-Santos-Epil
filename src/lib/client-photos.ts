import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const CLIENT_PHOTOS_BUCKET = "client-photos";

/** Links temporários (1 h) para fotos de clientes, guardadas em área privada. */
export async function signedClientPhotos(supabase: SupabaseClient, paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const { data } = await supabase.storage.from(CLIENT_PHOTOS_BUCKET).createSignedUrls(unique, 3600);
  for (const item of data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  return map;
}
