import type { Move } from "chess.js";

interface MoveListProps {
  moves: Move[];
  cursor: number; // 0 = posición base; k = tras k jugadas
  onSelect: (ply: number) => void;
}

/** Lista de jugadas en pares (blancas/negras). Click salta a esa jugada. */
export default function MoveList({ moves, cursor, onSelect }: MoveListProps) {
  if (moves.length === 0) {
    return <p className="text-xs text-gray-500">Mueve para empezar la variante.</p>;
  }

  // El primer movimiento puede ser de negras si la base no arranca con blancas a mover.
  const whiteStarts = moves[0].color === "w";

  return (
    <div className="flex flex-wrap gap-x-1 gap-y-1 text-sm">
      {moves.map((m, i) => {
        const ply = i + 1; // cursor tras jugar este movimiento
        const isWhite = m.color === "w";
        const moveNo = Math.floor((i + (whiteStarts ? 0 : 1)) / 2) + 1;
        const showNumber = isWhite || (i === 0 && !whiteStarts);
        return (
          <span key={i} className="inline-flex items-baseline gap-1">
            {showNumber && (
              <span className="text-gray-500">
                {moveNo}.{!isWhite ? ".." : ""}
              </span>
            )}
            <button
              type="button"
              onClick={() => onSelect(ply)}
              className={`rounded px-1 font-medium ${
                cursor === ply
                  ? "bg-emerald-600 text-white"
                  : "text-gray-200 active:bg-gray-700"
              }`}
            >
              {m.san}
            </button>
          </span>
        );
      })}
    </div>
  );
}
