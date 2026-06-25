import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Chess } from "chess.js";
import type { Key } from "chessground/types";
import Chessground from "../board/Chessground.tsx";
import { getGame } from "./repo.ts";
import type { Game } from "../db/schema.ts";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface ReplayData {
  fens: string[];
  sans: string[];
  moves: Array<[Key, Key]>;
}

function buildReplay(pgn: string): ReplayData {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const history = chess.history({ verbose: true });
  const startFen = history[0]?.before ?? START_FEN;
  const fens = [startFen, ...history.map((m) => m.after)];
  const sans = history.map((m) => m.san);
  const moves = history.map((m) => [m.from as Key, m.to as Key] as [Key, Key]);
  return { fens, sans, moves };
}

export default function GameViewPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<Game | undefined>();
  const [loading, setLoading] = useState(true);
  const [ply, setPly] = useState(0);

  useEffect(() => {
    if (!gameId) return;
    void (async () => {
      setGame(await getGame(gameId));
      setLoading(false);
    })();
  }, [gameId]);

  const replay = useMemo<ReplayData | null>(() => {
    if (!game) return null;
    try {
      return buildReplay(game.pgn);
    } catch {
      return null;
    }
  }, [game]);

  if (loading) return <p className="text-sm text-gray-400">Cargando…</p>;
  if (!game) return <p className="text-sm text-gray-400">Partida no encontrada.</p>;
  if (!replay)
    return <p className="text-sm text-red-400">No pude reproducir el PGN.</p>;

  const maxPly = replay.fens.length - 1;
  const clampedPly = Math.min(ply, maxPly);
  const orientation = game.my_color === "b" ? "black" : "white";
  const lastMove = clampedPly > 0 ? replay.moves[clampedPly - 1] : undefined;

  return (
    <div className="space-y-3">
      <div>
        <Link
          to={game.collection_id ? `/torneos/${game.collection_id}` : "/torneos"}
          className="text-sm text-gray-400"
        >
          ← Volver
        </Link>
        <h1 className="mt-1 text-lg font-semibold">
          {(game.white || "?") + " – " + (game.black || "?")}{" "}
          <span className="text-gray-400">{game.result || "*"}</span>
        </h1>
      </div>

      <Chessground
        fen={replay.fens[clampedPly]}
        orientation={orientation}
        viewOnly
        lastMove={lastMove}
      />

      <div className="flex items-center justify-between gap-2">
        <NavButton onClick={() => setPly(0)} disabled={clampedPly === 0} label="⏮" />
        <NavButton
          onClick={() => setPly((p) => Math.max(0, Math.min(p, maxPly) - 1))}
          disabled={clampedPly === 0}
          label="◀"
        />
        <span className="text-sm text-gray-400">
          {clampedPly}/{maxPly}
          {clampedPly > 0 && replay.sans[clampedPly - 1]
            ? ` · ${replay.sans[clampedPly - 1]}`
            : ""}
        </span>
        <NavButton
          onClick={() => setPly((p) => Math.min(maxPly, p + 1))}
          disabled={clampedPly === maxPly}
          label="▶"
        />
        <NavButton onClick={() => setPly(maxPly)} disabled={clampedPly === maxPly} label="⏭" />
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
