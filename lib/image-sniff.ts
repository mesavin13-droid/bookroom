/**
 * Detects the real image type from the file's first bytes. The browser-supplied
 * MIME type is attacker-controlled, so uploads are typed by content instead.
 */
export type ImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

export async function sniffImage(file: Blob): Promise<ImageMime | null> {
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const at = (i: number, ...bytes: number[]) => bytes.every((v, k) => b[i + k] === v);
  const ascii = (i: number, s: string) => at(i, ...Array.from(s, (c) => c.charCodeAt(0)));
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"))) return "image/avif";
  return null;
}

export const IMAGE_EXT: Record<ImageMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
