import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createCollection, listCollections } from "./repo.ts";
import type { Collection } from "../db/schema.ts";

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setCollections(await listCollections("tournament"));
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await createCollection(trimmed, "tournament");
    setName("");
    await refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Torneos</h1>

      <form onSubmit={onCreate} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nuevo torneo…"
          className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white active:bg-emerald-700"
        >
          Crear
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando…</p>
      ) : collections.length === 0 ? (
        <p className="text-sm text-gray-400">
          Aún no hay torneos. Crea uno para anotar tus partidas OTB.
        </p>
      ) : (
        <ul className="space-y-2">
          {collections.map((c) => (
            <li key={c.id}>
              <Link
                to={`/torneos/${c.id}`}
                className="block rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 active:bg-gray-700"
              >
                <span className="font-medium">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
