import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Tag, TagCategory } from "../db/schema.ts";
import { countPositionsByTag, listTags } from "../tags/repo.ts";
import { CATEGORIES, CATEGORY_LABEL, categoryChip } from "../tags/categories.ts";

export default function TrainPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [t, c] = await Promise.all([listTags(), countPositionsByTag()]);
      setTags(t);
      setCounts(c);
      setLoading(false);
    })();
  }, []);

  // Solo temas con posiciones, agrupados por categoría.
  const withPositions = tags.filter((t) => (counts.get(t.id) ?? 0) > 0);
  const groups: Array<{ category: TagCategory | "otros"; tags: Tag[] }> = [
    ...CATEGORIES.map((category) => ({
      category,
      tags: withPositions.filter((t) => t.category === category),
    })),
    { category: "otros" as const, tags: withPositions.filter((t) => !t.category) },
  ].filter((g) => g.tags.length > 0);

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
      ) : withPositions.length === 0 ? (
        <p className="text-sm text-gray-400">
          Aún no hay posiciones etiquetadas. Guarda tarjetas con temas desde Importar o Análisis.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.category} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {g.category === "otros" ? "Sin categoría" : CATEGORY_LABEL[g.category]}
              </h2>
              <ul className="space-y-2">
                {g.tags.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/entrenar/${t.id}`}
                      className={`flex items-center justify-between rounded-lg border bg-gray-800 px-4 py-3 active:bg-gray-700 ${categoryChip(t.category)}`}
                    >
                      <span className="font-medium text-gray-100">{t.name}</span>
                      <span className="text-sm text-gray-400">
                        {counts.get(t.id) ?? 0}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
