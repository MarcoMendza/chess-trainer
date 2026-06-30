import { uciLineToSan } from "../board/useChess.ts";
import { formatScore } from "./EvalBar.tsx";
import type { WhitePovLine } from "../engine/useEngine.ts";

/**
 * Panel del motor embebido: líneas MultiPV (score en óptica de blancas + SAN), selector de
 * número de líneas y botón "Detener". La barra de eval y la flecha de mejor jugada van
 * sobre el tablero (vía `autoShapes`/`evalBar`); este panel es solo el bloque de líneas.
 */
export default function EnginePanel({
  fen,
  lines,
  multipv,
  onMultipv,
  onStop,
}: {
  fen: string;
  lines: WhitePovLine[];
  multipv: number;
  onMultipv: (n: number) => void;
  onStop: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/60 p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Motor
        </span>
        <button
          type="button"
          onClick={onStop}
          className="rounded-lg border border-amber-700 px-3 py-1 text-xs text-amber-300 active:bg-amber-900/40"
        >
          ⏸ Detener motor
        </button>
      </div>
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
                {uciLineToSan(fen, l.pvUci).join(" ")}
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
  );
}
