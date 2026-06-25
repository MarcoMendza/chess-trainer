import type { TagCategory } from "../db/schema.ts";

export const CATEGORIES: TagCategory[] = [
  "finales",
  "estructura",
  "tactica",
  "apertura",
  "medio",
];

export const CATEGORY_LABEL: Record<TagCategory, string> = {
  finales: "Finales",
  estructura: "Estructura",
  tactica: "Táctica",
  apertura: "Apertura",
  medio: "Medio juego",
};

/** Clases Tailwind (texto/borde) por categoría, para chips y agrupadores. */
export const CATEGORY_CHIP: Record<TagCategory, string> = {
  finales: "border-sky-500/40 text-sky-300",
  estructura: "border-amber-500/40 text-amber-300",
  tactica: "border-red-500/40 text-red-300",
  apertura: "border-emerald-500/40 text-emerald-300",
  medio: "border-violet-500/40 text-violet-300",
};

export function categoryLabel(category: TagCategory | undefined): string {
  return category ? CATEGORY_LABEL[category] : "Sin categoría";
}

export function categoryChip(category: TagCategory | undefined): string {
  return category ? CATEGORY_CHIP[category] : "border-gray-500/40 text-gray-300";
}
