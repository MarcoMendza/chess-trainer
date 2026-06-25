import { useCallback, useMemo, useState } from "react";
import { Chess, type Move } from "chess.js";
import type { Key } from "chessground/types";
import { legalDests } from "../board/useChess.ts";

export const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export interface LineSeed {
  baseFen: string;
  moves: Move[];
  cursor: number;
}

/** Siembra una línea desde un FEN suelto (sin jugadas previas). */
export function lineFromFen(fen: string): LineSeed {
  return { baseFen: fen, moves: [], cursor: 0 };
}

/** Siembra una línea desde un PGN; opcionalmente posiciona el cursor en una jugada. */
export function lineFromPgn(pgn: string, cursor?: number): LineSeed {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const moves = chess.history({ verbose: true });
  const baseFen = moves[0]?.before ?? START_FEN;
  const max = moves.length;
  return { baseFen, moves, cursor: Math.min(cursor ?? max, max) };
}

/**
 * Estado de una línea de análisis **lineal** (sin árbol de ramas).
 * Mover desde un punto intermedio reemplaza la continuación (trunca y reanuda desde ahí).
 */
export function useAnalysisLine(seed: LineSeed) {
  const [baseFen, setBaseFen] = useState(seed.baseFen);
  const [moves, setMoves] = useState<Move[]>(seed.moves);
  const [cursor, setCursor] = useState(seed.cursor);

  const currentFen = cursor === 0 ? baseFen : moves[cursor - 1].after;

  const dests = useMemo(() => legalDests(new Chess(currentFen)), [currentFen]);

  const lastMove = useMemo<[Key, Key] | undefined>(
    () =>
      cursor > 0
        ? [moves[cursor - 1].from as Key, moves[cursor - 1].to as Key]
        : undefined,
    [moves, cursor],
  );

  const play = useCallback(
    (orig: Key, dest: Key) => {
      const chess = new Chess(currentFen);
      let move: Move;
      try {
        move = chess.move({ from: orig, to: dest, promotion: "q" });
      } catch {
        return; // ilegal (no debería pasar: dests viene de chess.js)
      }
      // Reemplaza la continuación a partir del cursor (variante lineal).
      setMoves((prev) => [...prev.slice(0, cursor), move]);
      setCursor((c) => c + 1);
    },
    [currentFen, cursor],
  );

  const goTo = useCallback(
    (i: number) => setCursor(Math.max(0, Math.min(i, moves.length))),
    [moves.length],
  );
  const back = useCallback(() => setCursor((c) => Math.max(0, c - 1)), []);
  const forward = useCallback(
    () => setCursor((c) => Math.min(moves.length, c + 1)),
    [moves.length],
  );

  const reset = useCallback((next: LineSeed) => {
    setBaseFen(next.baseFen);
    setMoves(next.moves);
    setCursor(next.cursor);
  }, []);

  return {
    baseFen,
    moves,
    cursor,
    currentFen,
    dests,
    lastMove,
    play,
    goTo,
    back,
    forward,
    reset,
    canBack: cursor > 0,
    canForward: cursor < moves.length,
  };
}
