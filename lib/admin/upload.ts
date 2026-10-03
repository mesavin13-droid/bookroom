import "server-only";
import type { AdminContext } from "@/lib/admin/context";
import { IMAGE_EXT, sniffImage } from "@/lib/image-sniff";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX = 5 * 1024 * 1024;

export function validateImage(file: unknown): string | null {
  if (!(file instanceof File) || file.size === 0) return "Выберите файл.";
  if (!ALLOWED.includes(file.type)) return "Поддерживаются JPG, PNG, WebP и AVIF.";
  if (file.size > MAX) return "Файл больше 5 МБ.";
  return null;
}

/** Uploads with the user's session: storage RLS checks studio admin rights by path prefix. */
export async function uploadStudioImage(ctx: AdminContext, bucket: "studio-assets" | "gallery", folder: string, file: File) {
  const mime = await sniffImage(file);
  if (!mime) throw new Error("INVALID_IMAGE");
  const path = `${ctx.studio.id}/${folder.replace(/[^a-z0-9-]/gi, "")}/${crypto.randomUUID()}.${IMAGE_EXT[mime]}`;
  const { error } = await ctx.supabase.storage.from(bucket).upload(path, file, { contentType: mime, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`upload failed: ${error.message}`);
  const { data } = ctx.supabase.storage.from(bucket).getPublicUrl(path);
  return { path, url: data.publicUrl };
}
