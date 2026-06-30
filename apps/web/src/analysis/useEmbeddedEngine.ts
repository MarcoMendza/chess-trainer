import { useCallback, useEffect, useMemo, useState } from "react";
import type { Key } from "chessground/types";
import type { DrawShape } from "chessground/draw";
import { useEngine } from "../engine/useEngine.ts";

/**
 * Motor on-device embebido en una pantalla (Anotar, ver partida): toggle de análisis
 * sobre un FEN dado, con la flecha de mejor jugada y la mejor línea ya listas para pintar.
 * Reusa `useEngine` (un worker por montaje); relanza al cambiar el FEN y `stop` al apagar.
 */
export function useEmbeddedEngine(fen: string) {
  const { ready, lines, analyze, stop, multipv, setMultipv } = useEngine();
  const [analyzing, setAnalyzing] = useState(false);

  // Relanza el análisis al cambiar de posición (el motor hace `stop` antes del `go`).
  useEffect(() => {
    if (analyzing && ready) analyze(fen);
  }, [analyzing, ready, fen, analyze]);

  // Al apagar, detén la búsqueda y limpia las líneas.
  useEffect(() => {
    if (!analyzing) stop();
  }, [analyzing, stop]);

  const best = lines[0];
  const autoShapes = useMemo<DrawShape[]>(() => {
    const uci = best?.pvUci[0];
    if (!analyzing || !uci) return [];
    return [
      { orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush: "green" },
    ];
  }, [best, analyzing]);

  const onMultipv = useCallback(
    (n: number) => {
      setMultipv(n);
      if (analyzing && ready) analyze(fen);
    },
    [analyzing, ready, fen, analyze, setMultipv],
  );

  return { ready, analyzing, setAnalyzing, lines, best, multipv, onMultipv, autoShapes };
}
