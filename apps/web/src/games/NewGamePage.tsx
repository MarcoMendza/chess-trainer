import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useVariationTree } from "../study/useVariationTree.ts";
import VariationEditor from "../study/VariationEditor.tsx";
import { hasMoves } from "../study/variations.ts";
import EvalBar from "../analysis/EvalBar.tsx";
import EnginePanel from "../analysis/EnginePanel.tsx";
import { useEmbeddedEngine } from "../analysis/useEmbeddedEngine.ts";
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
  const [showHelp, setShowHelp] = useState(false);

  // Motor embebido (reusa el on-device): analiza la posición del nodo actual.
  const engine = useEmbeddedEngine(variations.currentFen);

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
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-xl font-semibold">Nueva partida</h1>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-label="Ayuda"
            aria-expanded={showHelp}
            className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-600 text-xs text-gray-400 active:bg-gray-700"
          >
            ?
          </button>
        </div>
        {showHelp && (
          <div className="mt-2 space-y-1 rounded-lg border border-gray-700 bg-gray-800 p-3 text-xs text-gray-300">
            <p>
              Recrea la partida moviendo piezas. La línea que juegas es la principal;
              una jugada alternativa desde cualquier punto crea una variante.
            </p>
            <p className="text-gray-400">
              Juega al menos una jugada para poder guardar.
            </p>
          </div>
        )}
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
        autoShapes={engine.analyzing ? engine.autoShapes : undefined}
        evalBar={engine.analyzing ? <EvalBar best={engine.best} /> : undefined}
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
          onClick={() => engine.setAnalyzing((v) => !v)}
          disabled={!engine.ready}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs disabled:opacity-40 ${
            engine.analyzing
              ? "border-amber-600 text-amber-300 active:bg-amber-900/40"
              : "border-gray-600 active:bg-gray-700"
          }`}
        >
          {engine.ready ? "🔍 Analizar con motor" : "Cargando motor…"}
        </button>
      </div>

      {engine.analyzing && (
        <EnginePanel
          fen={variations.currentFen}
          lines={engine.lines}
          multipv={engine.multipv}
          onMultipv={engine.onMultipv}
          onStop={() => engine.setAnalyzing(false)}
        />
      )}

      <button
        type="button"
        onClick={() => setShowForm(true)}
        disabled={!movesYet}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-50"
      >
        Guardar partida
      </button>

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
