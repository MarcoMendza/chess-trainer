import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link, useParams } from "react-router-dom";
import { Chess } from "chess.js";
import type { Key } from "chessground/types";
import Chessground from "../board/Chessground.tsx";
import { getGame } from "./repo.ts";
import { pgnToTree } from "./pgnTree.ts";
import SaveGameSheet from "./SaveGameSheet.tsx";
import { hasMoves, nodeAtPath, type NodePath } from "../study/variations.ts";
import { useVariationTree } from "../study/useVariationTree.ts";
import VariationEditor from "../study/VariationEditor.tsx";
import VariationTree from "../study/VariationTree.tsx";
import EvalBar from "../analysis/EvalBar.tsx";
import EnginePanel from "../analysis/EnginePanel.tsx";
import { useEmbeddedEngine } from "../analysis/useEmbeddedEngine.ts";
import TagPicker from "../tags/TagPicker.tsx";
import { setGameTags, tagsForGame } from "../tags/repo.ts";
import type { Game, VariationNode } from "../db/schema.ts";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** FEN inicial del PGN: header [FEN "…"] si la partida arranca de una posición, o inicial. */
function startFenOf(pgn: string): string {
  const m = pgn.match(/\[FEN\s+"([^"]+)"\]/);
  return m ? m[1] : START_FEN;
}

/** Casillas de la jugada que llevó al nodo en `path` (para resaltar en el tablero). */
function moveSquares(
  root: VariationNode,
  path: NodePath,
): [Key, Key] | undefined {
  if (path.length === 0) return undefined;
  const node = nodeAtPath(root, path);
  const parent = nodeAtPath(root, path.slice(0, -1));
  if (!node?.move || !parent) return undefined;
  try {
    const mv = new Chess(parent.fen).move(node.move);
    return [mv.from as Key, mv.to as Key];
  } catch {
    return undefined;
  }
}

export default function GameViewPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<Game | undefined>();
  const [loading, setLoading] = useState(true);
  const [gameTagIds, setGameTagIds] = useState<string[]>([]);
  const [path, setPath] = useState<NodePath>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    void (async () => {
      setGame(await getGame(gameId));
      setGameTagIds((await tagsForGame(gameId)).map((t) => t.id));
      setLoading(false);
    })();
  }, [gameId]);

  // Recarga la partida tras guardar la edición (el PGN cambió).
  async function reloadGame() {
    if (!gameId) return;
    setGame(await getGame(gameId));
    setPath([]);
    setEditing(false);
  }

  function onTagsChange(ids: string[]) {
    setGameTagIds(ids);
    if (gameId) void setGameTags(gameId, ids);
  }

  // Re-lee el PGN como árbol (con sidelines y comentarios). Si el parseo no da jugadas,
  // `root` queda sin hijos y mostramos el aviso de PGN ilegible.
  const parsed = useMemo(() => {
    if (!game) return null;
    try {
      const startFen = startFenOf(game.pgn);
      return pgnToTree(game.pgn, startFen);
    } catch {
      return null;
    }
  }, [game]);

  if (loading) return <p className="text-sm text-gray-400">Cargando…</p>;
  if (!game) return <p className="text-sm text-gray-400">Partida no encontrada.</p>;
  // Fallback: si el árbol no trae jugadas, reproducción lineal con chess.js (no regresa
  // el comportamiento previo de las partidas pegadas).
  if (!parsed || parsed.root.children.length === 0)
    return <LinearReplay game={game} gameTagIds={gameTagIds} onTagsChange={onTagsChange} />;

  const { root, generalNote } = parsed;

  // Modo edición: editor de variantes compartido sembrado con el árbol parseado del PGN.
  if (editing) {
    return (
      <GameEditPane
        game={game}
        startFen={startFenOf(game.pgn)}
        root={root}
        generalNote={generalNote}
        onCancel={() => setEditing(false)}
        onSaved={() => void reloadGame()}
      />
    );
  }

  return (
    <GameTreeView
      game={game}
      root={root}
      generalNote={generalNote}
      path={path}
      setPath={setPath}
      gameTagIds={gameTagIds}
      onTagsChange={onTagsChange}
      onEdit={() => setEditing(true)}
    />
  );
}

// ===== Vista de lectura con árbol + motor embebido =====

function GameTreeView({
  game,
  root,
  generalNote,
  path,
  setPath,
  gameTagIds,
  onTagsChange,
  onEdit,
}: {
  game: Game;
  root: VariationNode;
  generalNote: string | null;
  path: NodePath;
  setPath: Dispatch<SetStateAction<NodePath>>;
  gameTagIds: string[];
  onTagsChange: (ids: string[]) => void;
  onEdit: () => void;
}) {
  const node = nodeAtPath(root, path) ?? root;
  const orientation = game.my_color === "b" ? "black" : "white";
  const lastMove = moveSquares(root, path);
  const canPrev = path.length > 0;
  const canNext = node.children.length > 0;
  const engine = useEmbeddedEngine(node.fen);

  return (
    <div className="space-y-3">
      <div>
        <Link
          to={game.collection_id ? `/torneos/${game.collection_id}` : "/torneos"}
          className="text-sm text-gray-400"
        >
          ← Volver
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">
            {(game.white || "?") + " – " + (game.black || "?")}{" "}
            <span className="text-gray-400">{game.result || "*"}</span>
          </h1>
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700"
          >
            ✎ Editar
          </button>
        </div>
      </div>

      {generalNote && (
        <p className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-sm italic text-gray-300">
          {generalNote}
        </p>
      )}

      <div className="flex gap-2">
        <EvalBar best={engine.analyzing ? engine.best : undefined} />
        <div className="flex-1">
          <Chessground
            fen={node.fen}
            orientation={orientation}
            viewOnly
            lastMove={lastMove}
            autoShapes={engine.analyzing ? engine.autoShapes : undefined}
          />
        </div>
      </div>

      {node.note && (
        <p className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-sm italic text-gray-300">
          {node.note}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <NavButton onClick={() => setPath([])} disabled={!canPrev} label="⏮" />
        <NavButton
          onClick={() => setPath((p) => p.slice(0, -1))}
          disabled={!canPrev}
          label="◀"
        />
        <span className="text-sm text-gray-400">
          {node.move ? node.move : "Inicio"}
        </span>
        <NavButton
          onClick={() => setPath((p) => [...p, 0])}
          disabled={!canNext}
          label="▶"
        />
      </div>

      {/* Árbol completo con variantes; tocar una jugada salta a esa posición. */}
      <VariationTree tree={root} selectedPath={path} onSelect={setPath} />

      <button
        type="button"
        onClick={() => engine.setAnalyzing((v) => !v)}
        disabled={!engine.ready}
        className={`w-full rounded-lg border px-4 py-2 text-sm disabled:opacity-40 ${
          engine.analyzing
            ? "border-amber-600 text-amber-300 active:bg-amber-900/40"
            : "border-gray-600 active:bg-gray-700"
        }`}
      >
        {engine.ready ? "🔍 Analizar con motor" : "Cargando motor…"}
      </button>

      {engine.analyzing && (
        <EnginePanel
          fen={node.fen}
          lines={engine.lines}
          multipv={engine.multipv}
          onMultipv={engine.onMultipv}
          onStop={() => engine.setAnalyzing(false)}
        />
      )}

      <div>
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
          Temas
        </h2>
        <TagPicker value={gameTagIds} onChange={onTagsChange} />
      </div>
    </div>
  );
}

// ===== Fallback lineal (chess.js) para PGN que el árbol no pudo reconstruir =====

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
  return {
    fens: [startFen, ...history.map((m) => m.after)],
    sans: history.map((m) => m.san),
    moves: history.map((m) => [m.from as Key, m.to as Key] as [Key, Key]),
  };
}

function LinearReplay({
  game,
  gameTagIds,
  onTagsChange,
}: {
  game: Game;
  gameTagIds: string[];
  onTagsChange: (ids: string[]) => void;
}) {
  const [ply, setPly] = useState(0);
  const replay = useMemo<ReplayData | null>(() => {
    try {
      return buildReplay(game.pgn);
    } catch {
      return null;
    }
  }, [game]);

  const maxPly = replay ? replay.fens.length - 1 : 0;
  const clampedPly = Math.min(ply, maxPly);
  const fen = replay ? replay.fens[clampedPly] : START_FEN;
  const engine = useEmbeddedEngine(fen);

  if (!replay)
    return <p className="text-sm text-red-400">No pude reproducir el PGN.</p>;

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

      <div className="flex gap-2">
        <EvalBar best={engine.analyzing ? engine.best : undefined} />
        <div className="flex-1">
          <Chessground
            fen={fen}
            orientation={orientation}
            viewOnly
            lastMove={lastMove}
            autoShapes={engine.analyzing ? engine.autoShapes : undefined}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
          Temas
        </h2>
        <TagPicker value={gameTagIds} onChange={onTagsChange} />
      </div>

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

      <button
        type="button"
        onClick={() => engine.setAnalyzing((v) => !v)}
        disabled={!engine.ready}
        className={`w-full rounded-lg border px-4 py-2 text-sm disabled:opacity-40 ${
          engine.analyzing
            ? "border-amber-600 text-amber-300 active:bg-amber-900/40"
            : "border-gray-600 active:bg-gray-700"
        }`}
      >
        {engine.ready ? "🔍 Analizar con motor" : "Cargando motor…"}
      </button>

      {engine.analyzing && (
        <EnginePanel
          fen={fen}
          lines={engine.lines}
          multipv={engine.multipv}
          onMultipv={engine.onMultipv}
          onStop={() => engine.setAnalyzing(false)}
        />
      )}
    </div>
  );
}

// ===== Modo edición: reusa el editor de variantes compartido =====

function GameEditPane({
  game,
  startFen,
  root,
  generalNote,
  onCancel,
  onSaved,
}: {
  game: Game;
  startFen: string;
  root: VariationNode;
  generalNote: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const variations = useVariationTree(startFen, root);
  const [orientation, setOrientation] = useState<"white" | "black">(
    game.my_color === "b" ? "black" : "white",
  );
  const [showForm, setShowForm] = useState(false);
  const movesYet = hasMoves(variations.tree);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onCancel} className="text-sm text-gray-400">
          ← Cancelar
        </button>
        <h1 className="text-lg font-semibold">Editar partida</h1>
        <button
          type="button"
          onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700"
        >
          ⟲ Girar
        </button>
      </div>

      <VariationEditor variations={variations} orientation={orientation} />

      <button
        type="button"
        onClick={variations.promote}
        disabled={variations.atRoot}
        className="w-full rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-300 active:bg-emerald-900/40 disabled:opacity-30"
      >
        ⭱ Promover a principal
      </button>

      <button
        type="button"
        onClick={() => setShowForm(true)}
        disabled={!movesYet}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-50"
      >
        Guardar cambios
      </button>

      {showForm && (
        <SaveGameSheet
          tree={variations.tree}
          collectionId={game.collection_id ?? ""}
          game={game}
          defaultGeneralNote={generalNote ?? ""}
          onClose={() => setShowForm(false)}
          onSaved={onSaved}
        />
      )}
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
