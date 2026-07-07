import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import Chessground from "../board/Chessground.tsx";
import { tryLoadFen } from "../board/useChess.ts";

// Editor de posición tipo Lichess: montar el tablero pieza por pieza y derivar el FEN.
// El tablero es un Chessground en solo-lectura (para reusar el set cburnett y el tema)
// con una rejilla transparente encima que captura el toque por casilla. La fuente de
// verdad es el estado de React (mapa casilla→pieza + turno + enroques); el FEN se
// genera a partir de él y se valida con chess.js.

type Role = "K" | "Q" | "R" | "B" | "N" | "P";
type PieceCode = `${"w" | "b"}${Role}`;
type Brush = PieceCode | "erase";

const ROLE_WORD: Record<Role, string> = {
  K: "king",
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
  P: "pawn",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

// `piece` es un elemento a medida de chessground (no está en JSX.IntrinsicElements).
const PieceEl = "piece" as unknown as ElementType;

/** Char FEN (mayúscula = blanca) → PieceCode; null si no es pieza. */
function codeFromFenChar(ch: string): PieceCode | null {
  const role = ch.toUpperCase();
  if (!"KQRBNP".includes(role)) return null;
  const color = ch === role ? "w" : "b";
  return `${color}${role as Role}` as PieceCode;
}

/** PieceCode → char FEN. */
function fenCharFromCode(code: PieceCode): string {
  const role = code[1];
  return code[0] === "w" ? role : role.toLowerCase();
}

/** Parsea la parte de colocación de un FEN a mapa casilla→pieza. */
function boardFromPlacement(placement: string): Map<string, PieceCode> {
  const board = new Map<string, PieceCode>();
  const rows = placement.split("/");
  for (let r = 0; r < 8; r++) {
    const rank = 8 - r;
    let file = 0;
    for (const ch of rows[r] ?? "") {
      if (/\d/.test(ch)) file += Number(ch);
      else {
        const code = codeFromFenChar(ch);
        if (code) board.set(`${FILES[file]}${rank}`, code);
        file++;
      }
    }
  }
  return board;
}

/** Mapa casilla→pieza → parte de colocación de un FEN. */
function placementFromBoard(board: Map<string, PieceCode>): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (const file of FILES) {
      const code = board.get(`${file}${rank}`);
      if (code) {
        if (empty) {
          row += empty;
          empty = 0;
        }
        row += fenCharFromCode(code);
      } else empty++;
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join("/");
}

interface BoardEditorProps {
  /** Emite el FEN completo actual (o null si la posición no es legal). */
  onFenChange: (fen: string | null) => void;
}

export default function BoardEditor({ onFenChange }: BoardEditorProps) {
  const [board, setBoard] = useState<Map<string, PieceCode>>(() =>
    boardFromPlacement(START_PLACEMENT),
  );
  const [turn, setTurn] = useState<"w" | "b">("w");
  const [castling, setCastling] = useState({ K: true, Q: true, k: true, q: true });
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [brush, setBrush] = useState<Brush>("wP");

  // FEN completo derivado del estado. En-passant y relojes fijos (no relevantes al montar).
  const castlingStr =
    (castling.K ? "K" : "") +
      (castling.Q ? "Q" : "") +
      (castling.k ? "k" : "") +
      (castling.q ? "q" : "") || "-";
  const placement = placementFromBoard(board);
  const fen = `${placement} ${turn} ${castlingStr} - 0 1`;
  const valid = useMemo(() => tryLoadFen(fen), [fen]);

  useEffect(() => {
    onFenChange(valid.ok ? fen : null);
  }, [fen, valid, onFenChange]);

  // Casillas en el orden de pintado de chessground para alinear la rejilla de toque:
  // con blancas abajo, arriba-izquierda es a8; con negras, h1.
  const squares = useMemo(() => {
    const out: string[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const rank = orientation === "white" ? 8 - r : 1 + r;
        const fileIdx = orientation === "white" ? c : 7 - c;
        out.push(`${FILES[fileIdx]}${rank}`);
      }
    }
    return out;
  }, [orientation]);

  function tap(sq: string) {
    setBoard((prev) => {
      const next = new Map(prev);
      if (brush === "erase") next.delete(sq);
      else next.set(sq, brush);
      return next;
    });
  }

  const palette: PieceCode[] = [
    "wK", "wQ", "wR", "wB", "wN", "wP",
    "bK", "bQ", "bR", "bB", "bN", "bP",
  ];

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full">
        {/* Solo muestra la colocación; el turno/enroque no afectan al dibujo. */}
        <Chessground fen={`${placement} w - - 0 1`} orientation={orientation} viewOnly />
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
          {squares.map((sq) => (
            <button
              key={sq}
              type="button"
              onClick={() => tap(sq)}
              aria-label={`Casilla ${sq}`}
              className="h-full w-full"
            />
          ))}
        </div>
      </div>

      {/* Paleta de piezas + goma */}
      <div className="grid grid-cols-7 gap-1.5">
        {palette.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setBrush(code)}
            aria-label={`Pieza ${code}`}
            className={`aspect-square rounded-lg border p-0.5 active:bg-gray-700 ${
              brush === code
                ? "border-emerald-500 bg-emerald-900/30"
                : "border-gray-700 bg-gray-800"
            }`}
          >
            <span className="cg-wrap piece-icon block h-full w-full">
              <PieceEl className={`${ROLE_WORD[code[1] as Role]} ${code[0] === "w" ? "white" : "black"}`} />
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBrush("erase")}
          aria-label="Goma (quitar pieza)"
          className={`flex aspect-square items-center justify-center rounded-lg border text-lg active:bg-gray-700 ${
            brush === "erase"
              ? "border-emerald-500 bg-emerald-900/30"
              : "border-gray-700 bg-gray-800"
          }`}
        >
          🧽
        </button>
      </div>

      {/* Acciones del tablero */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => setBoard(boardFromPlacement(START_PLACEMENT))}
          className="rounded-lg border border-gray-600 px-3 py-1.5 active:bg-gray-700"
        >
          Posición inicial
        </button>
        <button
          type="button"
          onClick={() => setBoard(new Map())}
          className="rounded-lg border border-gray-600 px-3 py-1.5 active:bg-gray-700"
        >
          Vaciar
        </button>
        <button
          type="button"
          onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
          className="rounded-lg border border-gray-600 px-3 py-1.5 active:bg-gray-700"
        >
          ⟲ Girar
        </button>
      </div>

      {/* Turno */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs text-gray-400">Juegan</span>
        <div className="flex overflow-hidden rounded-lg border border-gray-600">
          <button
            type="button"
            onClick={() => setTurn("w")}
            className={`px-3 py-1.5 text-xs ${turn === "w" ? "bg-emerald-600 text-white" : "active:bg-gray-700"}`}
          >
            Blancas
          </button>
          <button
            type="button"
            onClick={() => setTurn("b")}
            className={`px-3 py-1.5 text-xs ${turn === "b" ? "bg-emerald-600 text-white" : "active:bg-gray-700"}`}
          >
            Negras
          </button>
        </div>
      </div>

      {/* Derechos de enroque */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
        <span>Enroques</span>
        {(
          [
            ["K", "♔ corto"],
            ["Q", "♔ largo"],
            ["k", "♚ corto"],
            ["q", "♚ largo"],
          ] as const
        ).map(([flag, label]) => (
          <label key={flag} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={castling[flag]}
              onChange={(e) =>
                setCastling((c) => ({ ...c, [flag]: e.target.checked }))
              }
              className="accent-emerald-500"
            />
            {label}
          </label>
        ))}
      </div>

      {!valid.ok && (
        <p className="text-xs text-amber-400">
          Posición aún no legal: {valid.error}
        </p>
      )}
    </div>
  );
}
