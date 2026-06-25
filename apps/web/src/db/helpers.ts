import type { SyncBase } from "./schema.ts";

/** Epoch ms actual. */
export const now = (): number => Date.now();

/**
 * UUID v4 sin dependencia externa.
 * `crypto.randomUUID()` solo existe en secure context (HTTPS o localhost). Al entrar por
 * IP en `http://` no está disponible, así que caemos a `crypto.getRandomValues()`, que sí
 * funciona en contexto no seguro. Con el dev por HTTPS se usa la ruta nativa.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

/**
 * Construye los campos comunes de una fila nueva sincronizable.
 * Uso: `{ ...newRow(), name, type }`.
 */
export function newRow(): SyncBase {
  const ts = now();
  return { id: newId(), created_at: ts, updated_at: ts, deleted: 0 };
}

/**
 * Campos a mezclar al actualizar una fila (refresca updated_at).
 * Uso: `db.table.update(id, { ...touch(), ...cambios })`.
 */
export function touch(): { updated_at: number } {
  return { updated_at: now() };
}
