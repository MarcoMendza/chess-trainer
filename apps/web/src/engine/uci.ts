// Parser puro de las líneas de salida UCI de Stockfish. Sin estado ni DOM → fácil de testear.

export interface UciInfo {
  type: "info";
  depth?: number;
  multipv: number; // 1 si el motor no lo informa (MultiPV=1)
  scoreCp?: number; // centipeones, relativo al lado que mueve
  scoreMate?: number; // mate en N, relativo al lado que mueve
  pvUci: string[]; // variante principal en notación UCI (e2e4, e7e5, ...)
}

export type UciMessage =
  | UciInfo
  | { type: "bestmove"; best?: string; ponder?: string }
  | { type: "uciok" }
  | { type: "readyok" }
  | { type: "other"; raw: string };

/** Parsea una línea de salida del motor a un mensaje tipado. */
export function parseUci(line: string): UciMessage {
  const trimmed = line.trim();
  if (trimmed === "uciok") return { type: "uciok" };
  if (trimmed === "readyok") return { type: "readyok" };

  const tokens = trimmed.split(/\s+/);

  if (tokens[0] === "bestmove") {
    const ponderIdx = tokens.indexOf("ponder");
    return {
      type: "bestmove",
      best: tokens[1] && tokens[1] !== "(none)" ? tokens[1] : undefined,
      ponder: ponderIdx >= 0 ? tokens[ponderIdx + 1] : undefined,
    };
  }

  // `info string ...` y otros info sin datos de búsqueda no nos interesan.
  if (tokens[0] === "info" && tokens[1] !== "string") {
    const info: UciInfo = { type: "info", multipv: 1, pvUci: [] };
    for (let i = 1; i < tokens.length; i++) {
      switch (tokens[i]) {
        case "depth":
          info.depth = Number(tokens[++i]);
          break;
        case "multipv":
          info.multipv = Number(tokens[++i]);
          break;
        case "score":
          if (tokens[i + 1] === "cp") info.scoreCp = Number(tokens[i + 2]);
          else if (tokens[i + 1] === "mate") info.scoreMate = Number(tokens[i + 2]);
          i += 2;
          break;
        case "pv":
          info.pvUci = tokens.slice(i + 1);
          i = tokens.length;
          break;
      }
    }
    return info;
  }

  return { type: "other", raw: trimmed };
}
