import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { Key } from "chessground/types";
import type { DrawShape } from "chessground/draw";
import Chessground from "../board/Chessground.tsx";
import { toColor, uciLineToSan } from "../board/useChess.ts";
import {
  lineFromFen,
  lineFromPgn,
  START_FEN,
  useAnalysisLine,
  type LineSeed,
} from "./useAnalysisLine.ts";
import { useEngine } from "../engine/useEngine.ts";
import EvalBar, { formatScore } from "./EvalBar.tsx";
import MoveList from "./MoveList.tsx";

interface AnalysisState {
  fen?: string;
  pgn?: string;
  ply?: number;
}

export default function AnalysisPage() {
  const state = useLocation().state as AnalysisState | null;

  const seed = useMemo<LineSeed>(() => {
    try {
      if (state?.pgn) return lineFromPgn(state.pgn, state.ply);
      if (state?.fen) return lineFromFen(state.fen);
    } catch {
      /* PGN/FEN inválido → posición inicial */
    }
    return lineFromFen(START_FEN);
  }, [state?.pgn, state?.fen, state?.ply]);

  const line = useAnalysisLine(seed);
  const { reset } = line;
  // Si se entra de nuevo a /analizar con otra posición, resiembra la línea.
  useEffect(() => {
    reset(seed);
  }, [seed, reset]);

  const { ready, lines, analyze, stop, multipv, setMultipv } = useEngine();
  const [analyzing, setAnalyzing] = useState(false);

  // Lanza/relanza el análisis al cambiar la posición (el motor hace `stop` antes del `go`).
  useEffect(() => {
    if (analyzing && ready) analyze(line.currentFen);
  }, [analyzing, ready, line.currentFen, analyze]);

  // Al apagar, detén la búsqueda y limpia las líneas.
  useEffect(() => {
    if (!analyzing) stop();
  }, [analyzing, stop]);

  const best = lines[0];
  const turnColor = toColor(line.currentFen.split(" ")[1] === "b" ? "b" : "w");

  // Flecha de la mejor jugada (primer UCI de la línea principal).
  const autoShapes = useMemo<DrawShape[]>(() => {
    const uci = best?.pvUci[0];
    if (!analyzing || !uci) return [];
    return [{ orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush: "green" }];
  }, [best, analyzing]);

  function onMultipv(n: number) {
    setMultipv(n);
    if (analyzing && ready) analyze(line.currentFen);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link to="/importar" className="text-sm text-gray-400">
          ← Volver
        </Link>
        <h1 className="text-lg font-semibold">Análisis</h1>
      </div>

      <div className="flex gap-2">
        <EvalBar best={analyzing ? best : undefined} />
        <div className="flex-1">
          <Chessground
            fen={line.currentFen}
            turnColor={turnColor}
            dests={line.dests}
            lastMove={line.lastMove}
            autoShapes={autoShapes}
            onMove={line.play}
          />
        </div>
      </div>

      {/* Controles del motor */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAnalyzing((v) => !v)}
          disabled={!ready}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 ${
            analyzing ? "bg-amber-600 active:bg-amber-700" : "bg-emerald-600 active:bg-emerald-700"
          }`}
        >
          {ready ? (analyzing ? "Detener" : "Analizar") : "Cargando motor…"}
        </button>

        <label className="flex items-center gap-2 text-sm text-gray-300">
          Líneas
          <select
            value={multipv}
            onChange={(e) => onMultipv(Number(e.target.value))}
            className="rounded-lg border border-gray-600 bg-gray-800 px-2 py-1 text-sm"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between gap-2">
        <NavButton onClick={() => line.goTo(0)} disabled={!line.canBack} label="⏮" />
        <NavButton onClick={line.back} disabled={!line.canBack} label="◀" />
        <span className="text-sm text-gray-400">
          {line.cursor}/{line.moves.length}
        </span>
        <NavButton onClick={line.forward} disabled={!line.canForward} label="▶" />
        <NavButton
          onClick={() => line.goTo(line.moves.length)}
          disabled={!line.canForward}
          label="⏭"
        />
      </div>

      {/* Líneas del motor */}
      {analyzing && (
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
                  {uciLineToSan(line.currentFen, l.pvUci).join(" ")}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <div>
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
          Jugadas
        </h2>
        <MoveList moves={line.moves} cursor={line.cursor} onSelect={line.goTo} />
      </div>
    </div>
  );
}

function NavButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-gray-600 px-4 py-2 text-sm active:bg-gray-700 disabled:opacity-30"
    >
      {label}
    </button>
  );
}
