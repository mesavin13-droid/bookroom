/** Mirrors public.normalize_phone() in SQL. Returns E.164 or null. */
export function normalizePhone(input: string | null | undefined): string | null {
  const d = (input ?? "").replace(/\D/g, "");
  if (d.length < 10 || d.length > 15) return null;
  if (d.length === 10) return `+7${d}`;
  if (d.length === 11 && d.startsWith("8")) return `+7${d.slice(1)}`;
  return `+${d}`;
}

/** Progressive input mask for Russian numbers: +7 999 123-45-67 */
export function maskPhone(input: string) {
  let d = input.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (!d.startsWith("7")) return "+" + d.slice(0, 15);
  d = d.slice(0, 11);
  const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
  let out = "+7";
  if (p[0]) out += " " + p[0];
  if (p[1]) out += " " + p[1];
  if (p[2]) out += "-" + p[2];
  if (p[3]) out += "-" + p[3];
  return out;
}
