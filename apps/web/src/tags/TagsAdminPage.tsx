import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Tag, TagCategory } from "../db/schema.ts";
import {
  childrenOf,
  countPositionsBySubtree,
  deleteTag,
  getOrCreateTag,
  listTags,
  rootTags,
  setTagParent,
  updateTag,
  validParentIds,
  validParentIdsForNew,
} from "./repo.ts";
import { CATEGORIES, CATEGORY_LABEL } from "./categories.ts";

const inputClass =
  "rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500";

export default function TagsAdminPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const initialized = useRef(false);
  // Form de creación.
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<TagCategory>("tactica");
  const [newParent, setNewParent] = useState<string>(""); // "" = raíz

  async function refresh() {
    const [t, c] = await Promise.all([listTags(), countPositionsBySubtree()]);
    setTags(t);
    setCounts(c);
    // En la primera carga abrimos todo el árbol para gestionarlo cómodo.
    if (!initialized.current) {
      setExpanded(new Set(t.filter((x) => childrenOf(t, x.id).length > 0).map((x) => x.id)));
      initialized.current = true;
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onCreate() {
    if (!newName.trim()) return;
    // Con padre, la categoría se hereda; sin padre, se usa la elegida.
    await getOrCreateTag(newName, newCategory, newParent || null);
    setNewName("");
    setNewParent("");
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
    await updateTag(tag.id, { category }); // propaga al subárbol
    await refresh();
  }

  async function onParent(tag: Tag, parentId: string) {
    try {
      await setTagParent(tag.id, parentId || null);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo mover el tema.");
    }
  }

  async function onDelete(tag: Tag) {
    const n = counts.get(tag.id) ?? 0;
    const kids = childrenOf(tags, tag.id);
    const base =
      n > 0
        ? `Borrar «${tag.name}» lo quitará de las posiciones de su subárbol (${n}). No borra posiciones.`
        : `¿Borrar «${tag.name}»?`;
    if (!confirm(base + (kids.length ? "" : "\n¿Seguir?"))) return;

    let strategy: "promote" | "cascade" = "promote";
    if (kids.length > 0) {
      const cascade = confirm(
        `«${tag.name}» tiene ${kids.length} subtema(s).\n\n` +
          `Aceptar = borrar también todo el subárbol (cascada).\n` +
          `Cancelar = subir los subtemas un nivel y borrar solo este (recomendado).`,
      );
      strategy = cascade ? "cascade" : "promote";
    }
    await deleteTag(tag.id, strategy);
    await refresh();
  }

  // Opciones de padre válidas para el form de creación (tags de profundidad ≤ 3).
  const newParentOptions = validParentIdsForNew(tags)
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => !!t)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  function renderNode(tag: Tag, depth: number) {
    const kids = childrenOf(tags, tag.id);
    const isOpen = expanded.has(tag.id);
    const isTagRoot = tag.parent_id == null;
    const parentOptions = validParentIds(tags, tag.id)
      .map((id) => tags.find((t) => t.id === id))
      .filter((t): t is Tag => !!t)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    return (
      <li key={tag.id}>
        <div
          className="rounded-lg border border-gray-700 bg-gray-800"
          style={{ marginLeft: depth * 14 }}
        >
          <div className="flex items-center gap-1 px-1">
            {kids.length > 0 ? (
              <button
                type="button"
                onClick={() => toggle(tag.id)}
                aria-label={isOpen ? "Colapsar" : "Expandir"}
                className="px-2 py-2 text-gray-400"
              >
                {isOpen ? "▾" : "▸"}
              </button>
            ) : (
              <span className="w-7 shrink-0" />
            )}
            <button
              type="button"
              onClick={() => onRename(tag)}
              className="min-w-0 flex-1 truncate py-2 text-left text-sm font-medium"
            >
              {tag.name}
              <span className="ml-2 text-xs text-gray-500">
                {counts.get(tag.id) ?? 0}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(tag)}
              className="rounded px-2 py-1 text-sm text-red-400 active:bg-gray-700"
            >
              Borrar
            </button>
          </div>
          {/* Fila de controles: padre (mover) + categoría (solo raíz, propaga). */}
          <div className="flex flex-wrap items-center gap-2 px-2 pb-2 pl-9">
            <label className="flex items-center gap-1 text-xs text-gray-400">
              Padre
              <select
                value={tag.parent_id ?? ""}
                onChange={(e) => onParent(tag, e.target.value)}
                className="rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs"
              >
                <option value="">— Raíz —</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {isTagRoot && (
              <label className="flex items-center gap-1 text-xs text-gray-400">
                Categoría
                <select
                  value={tag.category ?? ""}
                  onChange={(e) => onCategory(tag, e.target.value as TagCategory)}
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
              </label>
            )}
          </div>
        </div>
        {isOpen && kids.length > 0 && (
          <ul className="mt-2 space-y-2">
            {kids.map((c) => renderNode(c, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  const roots = rootTags(tags);

  return (
    <div className="space-y-4">
      <div>
        <Link to="/entrenar" className="text-sm text-gray-400">
          ← Entrenar
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Gestionar temas</h1>
      </div>

      {/* Crear tema: nombre + padre (hereda categoría) o categoría si es raíz. */}
      <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nuevo tema…"
          className={`${inputClass} w-full`}
        />
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-400">
            Padre
            <select
              value={newParent}
              onChange={(e) => setNewParent(e.target.value)}
              className={inputClass}
            >
              <option value="">— Raíz —</option>
              {newParentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-400">
            Categoría
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as TagCategory)}
              disabled={newParent !== ""}
              className={`${inputClass} disabled:opacity-40`}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onCreate}
            className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white active:bg-emerald-700"
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

      {roots.length === 0 ? (
        <p className="text-sm text-gray-400">No hay temas todavía.</p>
      ) : (
        <ul className="space-y-2">{roots.map((t) => renderNode(t, 0))}</ul>
      )}
    </div>
  );
}
