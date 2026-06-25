import { useEffect, useMemo, useState } from "react";
import type { Tag, TagCategory } from "../db/schema.ts";
import { getOrCreateTag, listTags } from "./repo.ts";
import { CATEGORIES, CATEGORY_LABEL, categoryChip } from "./categories.ts";

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
  const [newCategory, setNewCategory] = useState<TagCategory>("tactica");

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
    const tag = await getOrCreateTag(name, newCategory);
    await refresh();
    add(tag.id);
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => remove(t.id)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${categoryChip(t.category)}`}
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
                {t.category ? CATEGORY_LABEL[t.category] : "—"}
              </span>
            </button>
          ))}

          {!exactExists && (
            <div className="flex items-center gap-2 border-t border-gray-700 bg-gray-800/60 px-3 py-2">
              <span className="text-sm text-gray-300">
                Crear «{query.trim()}»
              </span>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as TagCategory)}
                className="ml-auto rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={createAndAdd}
                className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white active:bg-emerald-700"
              >
                Crear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
