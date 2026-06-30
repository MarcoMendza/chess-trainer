import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Tag } from "../db/schema.ts";
import {
  childrenOf,
  countPositionsBySubtree,
  listTags,
  rootTags,
} from "../tags/repo.ts";
import { useCategories } from "../tags/categories.ts";

export default function TrainPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { categories, chip } = useCategories();

  useEffect(() => {
    void (async () => {
      const [t, c] = await Promise.all([listTags(), countPositionsBySubtree()]);
      setTags(t);
      setCounts(c);
      setLoading(false);
    })();
  }, []);

  const count = (id: string) => counts.get(id) ?? 0;
  const has = (id: string) => count(id) > 0; // nodos con tarjetas en su subárbol

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Raíces con contenido, agrupadas por categoría (la raíz define la categoría del árbol).
  const roots = rootTags(tags).filter((t) => has(t.id));
  const knownKeys = new Set(categories.map((c) => c.key));
  const groups: Array<{ key: string; title: string; tags: Tag[] }> = [
    ...categories.map((c) => ({
      key: c.key,
      title: c.label,
      tags: roots.filter((t) => t.category === c.key),
    })),
    {
      key: "__otros__",
      title: "Sin categoría",
      // Sin categoría o con un key que ya no existe (categoría borrada).
      tags: roots.filter((t) => !t.category || !knownKeys.has(t.category)),
    },
  ].filter((g) => g.tags.length > 0);

  function renderNode(tag: Tag, depth: number) {
    const kids = childrenOf(tags, tag.id).filter((c) => has(c.id));
    const isOpen = expanded.has(tag.id);
    return (
      <li key={tag.id}>
        <div
          className={`flex items-center gap-1 rounded-lg border bg-gray-800 active:bg-gray-700 ${chip(tag.category)}`}
          style={{ marginLeft: depth * 14 }}
        >
          {kids.length > 0 ? (
            <button
              type="button"
              onClick={() => toggle(tag.id)}
              aria-label={isOpen ? "Colapsar" : "Expandir"}
              className="px-2 py-3 text-gray-400"
            >
              {isOpen ? "▾" : "▸"}
            </button>
          ) : (
            <span className="w-7 shrink-0" />
          )}
          <Link
            to={`/entrenar/${tag.id}`}
            className="flex min-w-0 flex-1 items-center justify-between py-3 pr-3"
          >
            <span className="truncate font-medium text-gray-100">{tag.name}</span>
            <span className="ml-2 shrink-0 text-sm text-gray-400">
              {count(tag.id)}
            </span>
          </Link>
        </div>
        {isOpen && kids.length > 0 && (
          <ul className="mt-2 space-y-2">
            {kids.map((c) => renderNode(c, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Entrenar</h1>
        <Link to="/entrenar/temas" className="text-sm text-emerald-400">
          Gestionar temas
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : roots.length === 0 ? (
        <p className="text-sm text-gray-400">
          Aún no hay posiciones etiquetadas. Guarda tarjetas con temas desde Importar o Análisis.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.key} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {g.title}
              </h2>
              <ul className="space-y-2">{g.tags.map((t) => renderNode(t, 0))}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
