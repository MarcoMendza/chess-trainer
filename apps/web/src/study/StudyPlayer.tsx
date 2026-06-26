import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import type { Key } from "chessground/types";
import type { DrawShape } from "chessground/draw";
import Chessground from "../board/Chessground.tsx";
import { legalDests, toColor } from "../board/useChess.ts";
import type { NodeColor, VariationNode } from "../db/schema.ts";
import VariationTree from "./VariationTree.tsx";
import {
  childIndexByMove,
  nodeAtPath,
  pathFromSans,
  principalChildren,
  type NodePath,
} from "./variations.ts";

export type PlayMode = "color" | "strict";

/** Una jugada reproducida, con el color/feedback con que se pinta. */
interface PlayedMove {
  san: string;
  fen: string;
  from: Key;
  to: Key;
  /** Color del árbol, "offtree" (rojo automático) o null (en árbol, sin color). */
  feedback: NodeColor | "offtree" | null;
}

// Color del árbol → pincel de chessground para resaltar la casilla destino.
const BRUSH: Record<NodeColor | "offtree", DrawShape["brush"]> = {
  main: "green",
  sub: "yellow",
  bad: "red",
  conditional: "blue",
  offtree: "red",
};

const FEEDBACK_LABEL: Record<NodeColor | "offtree", string> = {
  main: "Línea principal",
  sub: "Subvariante válida",
  bad: "Jugada marcada como mala",
  conditional: "Continuación condicional",
  offtree: "Fuera del árbol",
};

interface StudyPlayerProps {
  rootFen: string;
  tree: VariationNode;
  orientation: "white" | "black";
  mode: PlayMode;
  onModeChange: (mode: PlayMode) => void;
  onAnalyze: (fen: string) => void;
}

/**
 * Reproducción de una tarjeta con árbol de variantes.
 * - Colorear (default): cualquier jugada legal; se pinta según el árbol; fuera de árbol = rojo.
 * - Estricto: solo deja jugar la principal (dests acotados a esa jugada).
 * Botones "Ver árbol" (revela el árbol) y "Analizar con motor" (handoff del FEN).
 */
export default function StudyPlayer({
  rootFen,
  tree,
  orientation,
  mode,
  onModeChange,
  onAnalyze,
}: StudyPlayerProps) {
  const [played, setPlayed] = useState<PlayedMove[]>([]);
  const [showTree, setShowTree] = useState(false);

  const currentFen = played.length ? played[played.length - 1].fen : rootFen;
  // Ruta en el árbol según las jugadas hechas; null si ya nos salimos del árbol.
  const treePath = useMemo<NodePath | null>(
    () => pathFromSans(tree, played.map((p) => p.san)),
    [tree, played],
  );
  const treeNode = treePath ? nodeAtPath(tree, treePath) : null;

  const turnColor = toColor(currentFen.split(" ")[1] === "b" ? "b" : "w");

  // Movimientos permitidos. Estricto: solo la(s) jugada(s) principal(es) del nodo actual.
  const dests = useMemo(() => {
    const full = legalDests(new Chess(currentFen));
    if (mode === "color" || !treeNode) return mode === "color" ? full : new Map();
    const allowed = new Map<Key, Key[]>();
    for (const child of principalChildren(treeNode)) {
      if (!child.move) continue;
      try {
        const mv = new Chess(currentFen).move(child.move);
        const from = mv.from as Key;
        const list = allowed.get(from) ?? [];
        list.push(mv.to as Key);
        allowed.set(from, list);
      } catch {
        /* ignora */
      }
    }
    return allowed;
  }, [currentFen, mode, treeNode]);

  const last = played[played.length - 1];
  const lastMove = last ? ([last.from, last.to] as [Key, Key]) : undefined;

  // Resalta la casilla destino con el color del feedback de la última jugada.
  const autoShapes = useMemo<DrawShape[]>(() => {
    if (!last) return [];
    const brush = BRUSH[last.feedback ?? "main"];
    return [{ orig: last.to, brush }];
  }, [last]);

  function play(orig: Key, dest: Key) {
    const chess = new Chess(currentFen);
    let mv;
    try {
      mv = chess.move({ from: orig, to: dest, promotion: "q" });
    } catch {
      return; // ilegal
    }
    let feedback: PlayedMove["feedback"];
    if (!treeNode) {
      feedback = "offtree"; // ya estábamos fuera del árbol
    } else {
      const idx = childIndexByMove(treeNode, mv.san);
      feedback = idx >= 0 ? treeNode.children[idx].color : "offtree";
    }
    setPlayed((prev) => [
      ...prev,
      { san: mv.san, fen: chess.fen(), from: orig, to: dest, feedback },
    ]);
  }

  function undo() {
    setPlayed((prev) => prev.slice(0, -1));
  }
  function restart() {
    setPlayed([]);
  }

  const noteToShow = treeNode?.note ?? null;
  const strictDone = mode === "strict" && treeNode && dests.size === 0;

  return (
    <div className="space-y-3">
      {/* Toggle de modo (por sesión) */}
      <div className="flex justify-center gap-1.5">
        <ModeButton
          active={mode === "color"}
          onClick={() => onModeChange("color")}
          label="Colorear"
        />
        <ModeButton
          active={mode === "strict"}
          onClick={() => onModeChange("strict")}
          label="Estricto"
        />
      </div>

      <Chessground
        fen={currentFen}
        orientation={orientation}
        turnColor={turnColor}
        dests={dests}
        lastMove={lastMove}
        autoShapes={autoShapes}
        onMove={play}
      />

      {/* Feedback de la última jugada */}
      {last ? (
        <p className="text-center text-sm">
          <span className={feedbackTextClass(last.feedback)}>
            ● {FEEDBACK_LABEL[last.feedback ?? "main"]}
          </span>
        </p>
      ) : (
        <p className="text-center text-sm text-gray-400">
          Reproduce la línea de memoria.
        </p>
      )}

      {noteToShow && (
        <p className="rounded-lg border border-gray-700 bg-gray-800 p-2 text-sm italic text-gray-300">
          {noteToShow}
        </p>
      )}

      {strictDone && (
        <p className="text-center text-sm text-emerald-400">
          ✅ Fin de la línea principal.
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={played.length === 0}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700 disabled:opacity-30"
        >
          ◀ Deshacer
        </button>
        <button
          type="button"
          onClick={restart}
          disabled={played.length === 0}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700 disabled:opacity-30"
        >
          ⏮ Reiniciar
        </button>
        <button
          type="button"
          onClick={() => setShowTree((v) => !v)}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700"
        >
          {showTree ? "Ocultar árbol" : "Ver árbol"}
        </button>
        <button
          type="button"
          onClick={() => onAnalyze(currentFen)}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700"
        >
          🔍 Analizar con motor
        </button>
      </div>

      {showTree && (
        <VariationTree tree={tree} selectedPath={treePath ?? undefined} />
      )}
    </div>
  );
}

function feedbackTextClass(feedback: NodeColor | "offtree" | null): string {
  switch (feedback) {
    case "main":
      return "text-emerald-400";
    case "sub":
      return "text-amber-400";
    case "conditional":
      return "text-sky-400";
    case "bad":
    case "offtree":
      return "text-red-400";
    default:
      return "text-gray-300";
  }
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs ${
        active
          ? "border-emerald-500 bg-emerald-600 text-white"
          : "border-gray-600 text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}
