import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../db/db.ts";
import { newRow, touch } from "../db/helpers.ts";
import type { Category } from "../db/schema.ts";

// Categorías de primer nivel, ahora como DATOS (store `categories`) en vez de constantes.
// `Tag.category` guarda el `key` (slug) de una categoría; aquí viven la paleta de colores,
// el CRUD, la semilla de fábrica y el hook `useCategories` que consumen las pantallas.

/** Tokens de color disponibles. Clases Tailwind LITERALES (no dinámicas) para no romper el purge. */
export const PALETTE: Record<string, string> = {
  sky: "border-sky-500/40 text-sky-300",
  amber: "border-amber-500/40 text-amber-300",
  red: "border-red-500/40 text-red-300",
  emerald: "border-emerald-500/40 text-emerald-300",
  violet: "border-violet-500/40 text-violet-300",
  rose: "border-rose-500/40 text-rose-300",
  lime: "border-lime-500/40 text-lime-300",
  cyan: "border-cyan-500/40 text-cyan-300",
};

export const COLOR_TOKENS = Object.keys(PALETTE);

const GRAY_CHIP = "border-gray-500/40 text-gray-300";

/** Clases del chip por token de color (gris si el token no existe / sin categoría). */
export function chipClass(color: string | undefined): string {
  return (color && PALETTE[color]) || GRAY_CHIP;
}

/** Las 5 categorías de fábrica: mismos slugs/labels/colores que la versión hardcodeada. */
export const DEFAULT_CATEGORIES: Array<{ key: string; label: string; color: string }> = [
  { key: "finales", label: "Finales", color: "sky" },
  { key: "estructura", label: "Estructura", color: "amber" },
  { key: "tactica", label: "Táctica", color: "red" },
  { key: "apertura", label: "Apertura", color: "emerald" },
  { key: "medio", label: "Medio juego", color: "violet" },
];

// ===== CRUD =====

export async function listCategories(): Promise<Category[]> {
  const cats = await db.categories.where("deleted").equals(0).toArray();
  return cats.sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "es"),
  );
}

/** Slug ASCII a partir del label (para el `key` estable de una categoría nueva). */
function slugify(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // quita diacríticos (á→a)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "categoria"
  );
}

export async function createCategory(
  label: string,
  color: string,
): Promise<Category> {
  // Incluye borradas para no reutilizar un key que aún podrían tener tags huérfanos.
  const all = await db.categories.toArray();
  const taken = new Set(all.map((c) => c.key));
  const base = slugify(label);
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}-${n++}`;
  const maxOrder = all.reduce((m, c) => Math.max(m, c.sort_order), -1);
  const cat: Category = {
    ...newRow(),
    key,
    label: label.trim(),
    color,
    sort_order: maxOrder + 1,
  };
  await db.categories.add(cat);
  return cat;
}

export async function updateCategory(
  id: string,
  changes: { label?: string; color?: string },
): Promise<void> {
  const patch: Record<string, unknown> = { ...touch() };
  if (changes.label !== undefined) patch.label = changes.label.trim();
  if (changes.color !== undefined) patch.color = changes.color;
  await db.categories.update(id, patch);
}

/**
 * Borra una categoría (físico) y deja SIN categoría a los tags que la usaban
 * (no borra tags ni posiciones). El subárbol de esos tags conserva su jerarquía.
 */
export async function deleteCategory(id: string): Promise<void> {
  const cat = await db.categories.get(id);
  if (!cat) return;
  await db.transaction("rw", db.categories, db.tags, async () => {
    await db.tags
      .where("category")
      .equals(cat.key)
      .modify((t: { category?: string }) => {
        delete t.category;
      });
    await db.categories.delete(id);
  });
}

/**
 * Semilla idempotente de las 5 categorías de fábrica (por `key`). Se llama al arranque;
 * cubre instalaciones nuevas y existentes (no depende del upgrade de Dexie).
 */
export async function ensureDefaultCategories(): Promise<void> {
  const existing = new Set((await db.categories.toArray()).map((c) => c.key));
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const d = DEFAULT_CATEGORIES[i];
    if (!existing.has(d.key)) {
      await db.categories.add({
        ...newRow(),
        key: d.key,
        label: d.label,
        color: d.color,
        sort_order: i,
      });
    }
  }
}

// ===== Hook de lectura para las pantallas =====

export interface UseCategories {
  categories: Category[];
  byKey: Map<string, Category>;
  reload: () => Promise<void>;
  /** Label legible de un key (o "Sin categoría"). */
  label: (key: string | undefined) => string;
  /** Clases del chip para un key (gris si no existe). */
  chip: (key: string | undefined) => string;
}

export function useCategories(): UseCategories {
  const [categories, setCategories] = useState<Category[]>([]);
  const reload = useCallback(async () => {
    setCategories(await listCategories());
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const byKey = useMemo(
    () => new Map(categories.map((c) => [c.key, c])),
    [categories],
  );
  return {
    categories,
    byKey,
    reload,
    label: (key) => (key && byKey.get(key)?.label) || "Sin categoría",
    chip: (key) => chipClass(key ? byKey.get(key)?.color : undefined),
  };
}
