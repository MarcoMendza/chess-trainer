import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCollection, listGames } from "./repo.ts";
import { listTags, tagIdsByGames } from "../tags/repo.ts";
import { categoryChip } from "../tags/categories.ts";
import type { Collection, Game, Tag } from "../db/schema.ts";

export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [collection, setCollection] = useState<Collection | undefined>();
  const [games, setGames] = useState<Game[]>([]);
  const [tagsByGame, setTagsByGame] = useState<Map<string, string[]>>(new Map());
  const [tagsById, setTagsById] = useState<Map<string, Tag>>(new Map());
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collectionId) return;
    void (async () => {
      const [coll, gs, tags] = await Promise.all([
        getCollection(collectionId),
        listGames(collectionId),
        listTags(),
      ]);
      setCollection(coll);
      setGames(gs);
      setTagsById(new Map(tags.map((t) => [t.id, t])));
      setTagsByGame(await tagIdsByGames(gs.map((g) => g.id)));
      setLoading(false);
    })();
  }, [collectionId]);

  // Tags que efectivamente etiquetan partidas de este torneo (chips de filtro).
  const usedTags = useMemo(() => {
    const ids = new Set<string>();
    for (const list of tagsByGame.values()) for (const id of list) ids.add(id);
    return [...ids]
      .map((id) => tagsById.get(id))
      .filter((t): t is Tag => !!t)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [tagsByGame, tagsById]);

  const visibleGames = filterTag
    ? games.filter((g) => (tagsByGame.get(g.id) ?? []).includes(filterTag))
    : games;

  if (loading) return <p className="text-sm text-gray-400">Cargando…</p>;
  if (!collection)
    return <p className="text-sm text-gray-400">Torneo no encontrado.</p>;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/torneos" className="text-sm text-gray-400">
          ← Torneos
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{collection.name}</h1>
      </div>

      <Link
        to={`/torneos/${collection.id}/nueva`}
        className="block rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-medium text-white active:bg-emerald-700"
      >
        + Anotar partida
      </Link>

      {usedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterTag(null)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filterTag === null
                ? "border-emerald-500 bg-emerald-600 text-white"
                : "border-gray-600 text-gray-300"
            }`}
          >
            Todas
          </button>
          {usedTags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterTag(t.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                filterTag === t.id
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : categoryChip(t.category)
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {visibleGames.length === 0 ? (
        <p className="text-sm text-gray-400">
          {filterTag ? "Ninguna partida con ese tema." : "Sin partidas todavía."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visibleGames.map((g) => (
            <li key={g.id}>
              <Link
                to={`/partida/${g.id}`}
                className="block rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 active:bg-gray-700"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {(g.white || "?") + " – " + (g.black || "?")}
                  </span>
                  <span className="text-sm text-gray-400">{g.result || "*"}</span>
                </div>
                <div className="mt-0.5 text-xs text-gray-400">
                  {[
                    g.round && `R${g.round}`,
                    g.board && `Mesa ${g.board}`,
                    g.time_control,
                    g.my_color && (g.my_color === "w" ? "jugué blancas" : "jugué negras"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
