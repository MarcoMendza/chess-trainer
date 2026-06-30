import { useEffect, useMemo, useState } from "react";
import type { Tag } from "../db/schema.ts";
import { childrenOf, getOrCreateTag, listTags, validParentIdsForNew } from "./repo.ts";
import { useCategories } from "./categories.ts";

interface TagPickerProps {
  /** IDs de tags seleccionados (controlado). */
  value: string[];
  onChange: (tagIds: string[]) => void;
}

/**
 * Selector de tags con autocomplete (mobile-first): reusa tags existentes al teclear,
 * muestra los seleccionados como chips removibles y permite crear uno nuevo con categoría.
 */
export default function TagPicker({ value, onChange }: TagPickerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");
  const { categories, label, chip } = useCategories();
  const [newCategory, setNewCategory] = useState<string>(""); // "" = primera categoría
  const [newParent, setNewParent] = useState<string>(""); // "" = raíz
  // Categoría efectiva: la elegida o, por defecto, la primera disponible.
  const effectiveCategory = newCategory || categories[0]?.key || "";

  async function refresh() {
    setTags(await listTags());
  }
  useEffect(() => {
    void refresh();
  }, []);

  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const selected = value.map((id) => byId.get(id)).filter((t): t is Tag => !!t);

  const q = query.trim().toLowerCase();
  const matches = q
    ? tags.filter(
        (t) => !value.includes(t.id) && t.name.toLowerCase().includes(q),
      )
    : [];
  const exactExists = tags.some((t) => t.name.toLowerCase() === q);

  function add(id: string) {
    if (!value.includes(id)) onChange([...value, id]);
    setQuery("");
  }
  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }
  async function createAndAdd() {
    const name = query.trim();
    if (!name) return;
    // Con padre, la categoría se hereda de él (igual que en Gestionar temas).
    const tag = await getOrCreateTag(name, effectiveCategory, newParent || null);
    setNewParent("");
    await refresh();
    add(tag.id);
  }

  // Padres válidos para un tag nuevo, acotados a la categoría que se está creando
  // (al elegir padre se hereda su categoría, así que solo tienen sentido los de la
  // misma categoría) y aplanados en orden jerárquico con su profundidad para indentar.
  const parentOptions = useMemo(() => {
    const valid = new Set(validParentIdsForNew(tags));
    const out: { tag: Tag; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const t of childrenOf(tags, parentId)) {
        if (t.category !== effectiveCategory) continue; // categoría = la de la raíz del subárbol
        if (valid.has(t.id)) out.push({ tag: t, depth });
        walk(t.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [tags, effectiveCategory]);

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => remove(t.id)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${chip(t.category)}`}
            >
              {t.name}
              <span aria-hidden className="text-gray-500">
                ✕
              </span>
            </button>
          ))}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Añadir tema… (escribe para buscar o crear)"
        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />

      {q && (
        <div className="overflow-hidden rounded-lg border border-gray-700">
          {matches.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => add(t.id)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm active:bg-gray-700"
            >
              <span>{t.name}</span>
              <span className="text-xs text-gray-500">
                {t.category ? label(t.category) : "—"}
              </span>
            </button>
          ))}

          {!exactExists && (
            <div className="space-y-2 border-t border-gray-700 bg-gray-800/60 px-3 py-2">
              <span className="text-sm text-gray-300">
                Crear «{query.trim()}»
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  Padre
                  <select
                    value={newParent}
                    onChange={(e) => setNewParent(e.target.value)}
                    className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs"
                  >
                    <option value="">— Raíz —</option>
                    {parentOptions.map(({ tag, depth }) => (
                      <option key={tag.id} value={tag.id}>
                        {depth > 0 ? `${"  ".repeat(depth)}└ ` : ""}
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-xs text-gray-400">
                  Categoría
                  <select
                    value={effectiveCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    disabled={newParent !== ""}
                    className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs disabled:opacity-40"
                  >
                    {categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={createAndAdd}
                  className="ml-auto rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white active:bg-emerald-700"
                >
                  Crear
                </button>
              </div>
              {newParent !== "" && (
                <p className="text-xs text-gray-500">
                  Hereda la categoría del tema padre.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
