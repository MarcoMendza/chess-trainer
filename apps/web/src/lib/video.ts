// El link de video es de primera clase: al repasar, un toque te lleva al momento exacto
// del curso (source_url + source_time). Aquí se combina la url con el minuto guardado.

/** Convierte "mm:ss" o "hh:mm:ss" (o segundos sueltos) a segundos. null si no parsea. */
export function parseTimeToSeconds(time: string | undefined): number | null {
  if (!time) return null;
  const clean = time.trim();
  if (!clean) return null;
  const parts = clean.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/**
 * Devuelve la url lista para abrir en el minuto dado. Para YouTube/Vimeo añade el
 * parámetro de tiempo; para cualquier otra, añade `t=<seg>` de forma genérica.
 * Si no hay tiempo válido, devuelve la url tal cual.
 */
export function videoUrlAt(url: string, time?: string): string {
  const seconds = parseTimeToSeconds(time);
  if (seconds == null) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("t", `${seconds}`);
    return u.toString();
  } catch {
    // url no absoluta: degradar con un fragmento de tiempo simple.
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}t=${seconds}`;
  }
}
