import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Tag, TagCategory } from "../db/schema.ts";
import {
  countPositionsByTag,
  deleteTag,
  getOrCreateTag,
  listTags,
  updateTag,
} from "./repo.ts";
import { CATEGORIES, CATEGORY_LABEL } from "./categories.ts";

const inputClass =
  "rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500";

export default function TagsAdminPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<TagCategory>("tactica");

  async function refresh() {
    const [t, c] = await Promise.all([listTags(), countPositionsByTag()]);
    setTags(t);
    setCounts(c);
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate() {
    if (!newName.trim()) return;
    await getOrCreateTag(newName, newCategory);
    setNewName("");
    await refresh();
  }

  async function onRename(tag: Tag) {
    const name = prompt("Nuevo nombre del tema:", tag.name);
    if (name && name.trim() && name.trim() !== tag.name) {
      await updateTag(tag.id, { name });
      await refresh();
    }
  }

  async function onCategory(tag: Tag, category: TagCategory) {
    await updateTag(tag.id, { category });
    await refresh();
  }

  async function onDelete(tag: Tag) {
    const n = counts.get(tag.id) ?? 0;
    const msg =
      n > 0
        ? `Borrar «${tag.name}» quitará el tema de ${n} posición(es) (no borra las posiciones). ¿Seguir?`
        : `¿Borrar «${tag.name}»?`;
    if (confirm(msg)) {
      await deleteTag(tag.id);
      await refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/entrenar" className="text-sm text-gray-400">
          ← Entrenar
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Gestionar temas</h1>
      </div>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nuevo tema…"
          className={`${inputClass} flex-1`}
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value as TagCategory)}
          className={inputClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white active:bg-emerald-700"
        >
          Crear
        </button>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-gray-400">No hay temas todavía.</p>
      ) : (
        <ul className="space-y-2">
          {tags.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => onRename(t)}
                className="min-w-0 flex-1 truncate text-left text-sm font-medium"
              >
                {t.name}
                <span className="ml-2 text-xs text-gray-500">
                  {counts.get(t.id) ?? 0}
                </span>
              </button>
              <select
                value={t.category ?? ""}
                onChange={(e) =>
                  onCategory(t, e.target.value as TagCategory)
                }
                className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs"
              >
                <option value="" disabled>
                  Categoría
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onDelete(t)}
                className="rounded px-2 py-1 text-sm text-red-400 active:bg-gray-700"
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
