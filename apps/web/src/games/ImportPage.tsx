import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Chess } from "chess.js";
import type { Key } from "chessground/types";
import Chessground from "../board/Chessground.tsx";
import { legalDests, toColor, tryLoadFen, tryLoadPgn } from "../board/useChess.ts";
import { createGame, extractPgnHeaders, listCollections } from "./repo.ts";
import { saveLooseFen } from "../study/repo.ts";
import type { Collection } from "../db/schema.ts";

const inputClass =
  "w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500";

export default function ImportPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Importar</h1>
      <ImportPgnSection />
      <LoadFenSection />
    </div>
  );
}

// ===== Importar PGN =====

function ImportPgnSection() {
  const navigate = useNavigate();
  const [pgn, setPgn] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listCollections("tournament").then(setCollections);
  }, []);

  async function onImport() {
    const parsed = tryLoadPgn(pgn);
    if (!parsed.ok) {
      setError(`PGN inválido: ${parsed.error}`);
      return;
    }
    setError(null);
    const headers = extractPgnHeaders(pgn) ?? {};
    const game = await createGame({
      collection_id: collectionId || null,
      pgn: pgn.trim(),
      white: headers.white,
      black: headers.black,
      result: headers.result,
      played_on: headers.played_on,
      eco: headers.eco,
      round: headers.round,
      source: "import",
    });
    navigate(`/partida/${game.id}`);
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Importar PGN</h2>
      <textarea
        value={pgn}
        onChange={(e) => setPgn(e.target.value)}
        rows={5}
        placeholder="Pega un PGN…"
        className={`${inputClass} font-mono`}
      />
      <label className="block">
        <span className="mb-1 block text-xs text-gray-400">Añadir a torneo (opcional)</span>
        <select
          className={inputClass}
          value={collectionId}
          onChange={(e) => setCollectionId(e.target.value)}
        >
          <option value="">Sin torneo</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onImport}
          disabled={!pgn.trim()}
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-40"
        >
          Importar partida
        </button>
        <button
          type="button"
          onClick={() => {
            if (!tryLoadPgn(pgn).ok) {
              setError("PGN inválido.");
              return;
            }
            navigate("/analizar", { state: { pgn: pgn.trim() } });
          }}
          disabled={!pgn.trim()}
          className="rounded-lg border border-gray-600 px-4 py-3 text-sm active:bg-gray-700 disabled:opacity-40"
        >
          Analizar
        </button>
      </div>
    </section>
  );
}

// ===== Cargar FEN =====

function LoadFenSection() {
  const navigate = useNavigate();
  const [fenInput, setFenInput] = useState("");
  const [chess, setChess] = useState<Chess | null>(null);
  const [idea, setIdea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  // bump fuerza re-render + recálculo tras mutar la instancia chess (move).
  const [bump, setBump] = useState(0);

  const dests = useMemo(
    () => (chess ? legalDests(chess) : new Map<Key, Key[]>()),
    [chess, bump],
  );

  function onLoad() {
    const parsed = tryLoadFen(fenInput);
    if (!parsed.ok) {
      setError(`FEN inválido: ${parsed.error}`);
      setChess(null);
      return;
    }
    setError(null);
    setSavedMsg(null);
    setChess(parsed.chess);
  }

  function onMove(orig: Key, dest: Key) {
    if (!chess) return;
    try {
      chess.move({ from: orig, to: dest, promotion: "q" });
      setBump((b) => b + 1);
    } catch {
      // movimiento ilegal (no debería ocurrir: dests viene de chess.js)
    }
  }

  async function onSave() {
    if (!chess) return;
    await saveLooseFen(chess.fen(), idea.trim() || undefined);
    setSavedMsg("Guardado como tarjeta en «Posiciones sueltas».");
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium">Cargar FEN</h2>
      <div className="flex gap-2">
        <input
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
          placeholder="Pega un FEN…"
          className={`${inputClass} font-mono`}
        />
        <button
          type="button"
          onClick={onLoad}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white active:bg-emerald-700"
        >
          Cargar
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {chess && (
        <div className="space-y-3">
          <Chessground
            fen={chess.fen()}
            turnColor={toColor(chess.turn())}
            dests={dests}
            onMove={onMove}
          />
          <p className="text-xs text-gray-400">
            Puedes mover piezas para explorar la posición.
          </p>
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Idea / nota (opcional)…"
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm active:bg-gray-700"
            >
              Guardar como tarjeta
            </button>
            <button
              type="button"
              onClick={() => navigate("/analizar", { state: { fen: chess.fen() } })}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white active:bg-emerald-700"
            >
              Analizar
            </button>
          </div>
          {savedMsg && <p className="text-sm text-emerald-400">{savedMsg}</p>}
        </div>
      )}
    </section>
  );
}
