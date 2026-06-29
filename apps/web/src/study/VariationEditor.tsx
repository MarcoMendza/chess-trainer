import Chessground from "../board/Chessground.tsx";
import { toColor } from "../board/useChess.ts";
import VariationTree from "./VariationTree.tsx";
import type { useVariationTree } from "./useVariationTree.ts";
import type { NodeColor } from "../db/schema.ts";

export const COLOR_OPTIONS: Array<{
  value: NodeColor;
  label: string;
  className: string;
}> = [
  { value: "main", label: "Principal", className: "bg-emerald-600" },
  { value: "sub", label: "Subvariante", className: "bg-amber-600" },
  { value: "conditional", label: "Condicional", className: "bg-sky-600" },
  { value: "bad", label: "Mala", className: "bg-red-600" },
];

/**
 * Tablero interactivo + controles de nodo + árbol en vivo.
 * Construyes la línea moviendo piezas; eliges el nodo en el árbol para colorearlo
 * o anotarlo. La raíz (posición de la tarjeta) no admite color ni nota.
 */
export default function VariationEditor({
  variations,
  orientation,
}: {
  variations: ReturnType<typeof useVariationTree>;
  orientation: "white" | "black";
}) {
  const turnColor = toColor(
    variations.currentFen.split(" ")[1] === "b" ? "b" : "w",
  );
  return (
    <div className="space-y-3">
      <div className="mx-auto w-56">
        <Chessground
          fen={variations.currentFen}
          orientation={orientation}
          turnColor={turnColor}
          dests={variations.dests}
          lastMove={variations.lastMove}
          coordinates={false}
          onMove={variations.play}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={variations.back}
          disabled={variations.atRoot}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700 disabled:opacity-30"
        >
          ◀ Atrás
        </button>
        <button
          type="button"
          onClick={variations.reset}
          disabled={variations.atRoot}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700 disabled:opacity-30"
        >
          ⏮ Inicio
        </button>
        <button
          type="button"
          onClick={variations.deleteCurrent}
          disabled={variations.atRoot}
          className="rounded-lg border border-red-700 px-3 py-1.5 text-xs text-red-300 active:bg-red-900/40 disabled:opacity-30"
        >
          🗑 Borrar nodo
        </button>
      </div>

      {/* Controles del nodo seleccionado */}
      {variations.atRoot ? (
        <p className="text-center text-xs text-gray-500">
          Mueve una pieza para empezar la línea principal.
        </p>
      ) : (
        <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/60 p-2">
          <div className="grid grid-cols-4 gap-1.5">
            {COLOR_OPTIONS.map((opt) => {
              const active = variations.current.color === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => variations.setColor(active ? null : opt.value)}
                  className={`rounded-lg px-1 py-1.5 text-xs font-medium text-white ${opt.className} ${
                    active ? "ring-2 ring-white" : "opacity-70"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={variations.current.note ?? ""}
            onChange={(e) => variations.setNote(e.target.value)}
            rows={2}
            placeholder="Nota para esta jugada (opcional)"
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      )}

      <VariationTree
        tree={variations.tree}
        selectedPath={variations.path}
        onSelect={variations.goToPath}
      />
    </div>
  );
}
