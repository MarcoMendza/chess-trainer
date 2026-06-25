import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCollection, listGames } from "./repo.ts";
import type { Collection, Game } from "../db/schema.ts";

export default function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [collection, setCollection] = useState<Collection | undefined>();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collectionId) return;
    void (async () => {
      setCollection(await getCollection(collectionId));
      setGames(await listGames(collectionId));
      setLoading(false);
    })();
  }, [collectionId]);

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

      {games.length === 0 ? (
        <p className="text-sm text-gray-400">Sin partidas todavía.</p>
      ) : (
        <ul className="space-y-2">
          {games.map((g) => (
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
