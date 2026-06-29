import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Key } from "chessground/types";
import type { DrawShape } from "chessground/draw";
import { useVariationTree } from "../study/useVariationTree.ts";
import VariationEditor from "../study/VariationEditor.tsx";
import { hasMoves } from "../study/variations.ts";
import { uciLineToSan } from "../board/useChess.ts";
import { useEngine } from "../engine/useEngine.ts";
import EvalBar, { formatScore } from "../analysis/EvalBar.tsx";
import { getCollection, listGames } from "./repo.ts";
import SaveGameSheet from "./SaveGameSheet.tsx";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Anotar una partida recreándola en el tablero (Fase Anotar). Reusa el editor de
 * variantes: la cadena de primeros hijos es la partida real; las alternativas son
 * sidelines. Botones "Promover a principal" (estilo ChessBase) y "Analizar con motor".
 * Al guardar, el árbol se serializa a PGN (no usa el store de variantes de las tarjetas).
 */
export default function NewGamePage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const variations = useVariationTree(START_FEN);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [collectionName, setCollectionName] = useState("");
  const [defaultTimeControl, setDefaultTimeControl] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  // Motor embebido (reusa el on-device): analiza la posición del nodo actual.
  const { ready, lines, analyze, stop, multipv, setMultipv } = useEngine();
  const [analyzing, setAnalyzing] = useState(false);
  const currentFen = variations.currentFen;

  // Relanza el análisis al cambiar de posición (el motor hace `stop` antes del `go`).
  useEffect(() => {
    if (analyzing && ready) analyze(currentFen);
  }, [analyzing, ready, currentFen, analyze]);

  // Al apagar, detén la búsqueda y limpia las líneas.
  useEffect(() => {
    if (!analyzing) stop();
  }, [analyzing, stop]);

  const best = lines[0];
  const autoShapes = useMemo<DrawShape[]>(() => {
    const uci = best?.pvUci[0];
    if (!analyzing || !uci) return [];
    return [{ orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush: "green" }];
  }, [best, analyzing]);

  function onMultipv(n: number) {
    setMultipv(n);
    if (analyzing && ready) analyze(currentFen);
  }

  // Ritmo heredado del torneo: prefill desde el último juego de la colección.
  useEffect(() => {
    if (!collectionId) return;
    void (async () => {
      const [coll, games] = await Promise.all([
        getCollection(collectionId),
        listGames(collectionId),
      ]);
      setCollectionName(coll?.name ?? "");
      const lastTc = games.find((g) => g.time_control)?.time_control;
      if (lastTc) setDefaultTimeControl(lastTc);
    })();
  }, [collectionId]);

  if (!collectionId) {
    return <p className="text-sm text-gray-400">Torneo no encontrado.</p>;
  }

  const movesYet = hasMoves(variations.tree);

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/torneos/${collectionId}`} className="text-sm text-gray-400">
          ← {collectionName || "Volver"}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Nueva partida</h1>
        <p className="mt-1 text-xs text-gray-400">
          Recrea la partida moviendo piezas. La línea que juegas es la principal; una
          jugada alternativa desde cualquier punto crea una variante.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700"
        >
          ⟲ Girar tablero
        </button>
      </div>

      <VariationEditor
        variations={variations}
        orientation={orientation}
        autoShapes={analyzing ? autoShapes : undefined}
        evalBar={analyzing ? <EvalBar best={best} /> : undefined}
      />

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={variations.promote}
          disabled={variations.atRoot}
          className="flex-1 rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-300 active:bg-emerald-900/40 disabled:opacity-30"
        >
          ⭱ Promover a principal
        </button>
        <button
          type="button"
          onClick={() => setAnalyzing((v) => !v)}
          disabled={!ready}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs disabled:opacity-40 ${
            analyzing
              ? "border-amber-600 text-amber-300 active:bg-amber-900/40"
              : "border-gray-600 active:bg-gray-700"
          }`}
        >
          {ready ? "🔍 Analizar con motor" : "Cargando motor…"}
        </button>
      </div>

      {/* Panel del motor embebido (líneas MultiPV + selector). */}
      {analyzing && (
        <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/60 p-2">
          <div className="space-y-1">
            {lines.length === 0 ? (
              <p className="text-xs text-gray-500">Pensando…</p>
            ) : (
              lines.map((l) => (
                <div key={l.multipv} className="flex gap-2 text-xs">
                  <span className="w-12 shrink-0 font-mono tabular-nums text-emerald-400">
                    {formatScore(l)}
                  </span>
                  <span className="truncate text-gray-300">
                    {uciLineToSan(currentFen, l.pvUci).join(" ")}
                  </span>
                </div>
              ))
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            Líneas
            <select
              value={multipv}
              onChange={(e) => onMultipv(Number(e.target.value))}
              className="rounded-lg border border-gray-600 bg-gray-800 px-2 py-1 text-xs"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowForm(true)}
        disabled={!movesYet}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-50"
      >
        Guardar partida
      </button>
      {!movesYet && (
        <p className="text-center text-xs text-gray-500">
          Juega al menos una jugada para guardar.
        </p>
      )}

      {showForm && (
        <SaveGameSheet
          tree={variations.tree}
          collectionId={collectionId}
          defaultTimeControl={defaultTimeControl}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
