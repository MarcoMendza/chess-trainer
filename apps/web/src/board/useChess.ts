import { Chess } from "chess.js";
import type { Color, PieceSymbol, Square } from "chess.js";
import type { Key } from "chessground/types";

/** chess.js 'w'|'b' → orientación/turno de chessground. */
export function toColor(turn: Color): "white" | "black" {
  return turn === "w" ? "white" : "black";
}

/**
 * Mapa de movimientos legales por casilla origen, en el formato que chessground espera
 * (`movable.dests`). Se calcula con chess.js, única fuente de legalidad.
 */
export function legalDests(chess: Chess): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const move of chess.moves({ verbose: true })) {
    const from = move.from as Key;
    const list = dests.get(from);
    if (list) list.push(move.to as Key);
    else dests.set(from, [move.to as Key]);
  }
  return dests;
}

/** Valida un FEN sin lanzar; devuelve la instancia o un mensaje de error. */
export function tryLoadFen(
  fen: string,
): { ok: true; chess: Chess } | { ok: false; error: string } {
  try {
    const chess = new Chess(fen.trim());
    return { ok: true, chess };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "FEN inválido" };
  }
}

/** Valida/parsea un PGN sin lanzar; devuelve la instancia o un mensaje de error. */
export function tryLoadPgn(
  pgn: string,
): { ok: true; chess: Chess } | { ok: false; error: string } {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn.trim());
    return { ok: true, chess };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "PGN inválido" };
  }
}

/**
 * Promoción por defecto a dama. chessground entrega from/to; chess.js necesita saber
 * la pieza de promoción cuando un peón llega a la última fila.
 */
export function defaultPromotion(): PieceSymbol {
  return "q";
}

/**
 * Convierte una variante en UCI (e2e4, e7e5, …) a SAN, reproduciéndola sobre `fen`.
 * Corta si alguna jugada resulta ilegal. `max` acota la longitud mostrada.
 */
export function uciLineToSan(fen: string, uci: string[], max = 8): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const u of uci.slice(0, max)) {
    try {
      const move = chess.move({
        from: u.slice(0, 2),
        to: u.slice(2, 4),
        promotion: u.length > 4 ? u[4] : undefined,
      });
      out.push(move.san);
    } catch {
      break;
    }
  }
  return out;
}

export type { Square };
