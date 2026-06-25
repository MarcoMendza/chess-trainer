import type { SyncBase } from "./schema.ts";

/** Epoch ms actual. */
export const now = (): number => Date.now();

/** UUID v4 nativo del navegador (sin dependencia externa). */
export const newId = (): string => crypto.randomUUID();

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
