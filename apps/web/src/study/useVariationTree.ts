import { useCallback, useMemo, useState } from "react";
import { Chess } from "chess.js";
import type { Key } from "chessground/types";
import { legalDests } from "../board/useChess.ts";
import type { NodeColor, VariationNode } from "../db/schema.ts";
import {
  addChildMove,
  createTree,
  deleteAtPath,
  nodeAtPath,
  setColorAtPath,
  setNoteAtPath,
  type NodePath,
} from "./variations.ts";

/**
 * Estado del árbol de variantes para el editor (SaveCardSheet).
 * Mantiene el árbol completo y la ruta seleccionada; mover una pieza desde el nodo
 * actual crea (o reutiliza) un hijo y navega hacia él. Coloca color/nota en el nodo
 * seleccionado (la raíz no admite color/nota).
 */
export function useVariationTree(rootFen: string) {
  const [tree, setTree] = useState<VariationNode>(() => createTree(rootFen));
  const [path, setPath] = useState<NodePath>([]);

  const current = nodeAtPath(tree, path) ?? tree;
  const currentFen = current.fen;
  const atRoot = path.length === 0;

  const dests = useMemo(
    () => legalDests(new Chess(currentFen)),
    [currentFen],
  );

  // Resalta la jugada que llevó al nodo actual (recalcula from/to desde el SAN).
  const lastMove = useMemo<[Key, Key] | undefined>(() => {
    if (atRoot || !current.move) return undefined;
    const parent = nodeAtPath(tree, path.slice(0, -1));
    if (!parent) return undefined;
    try {
      const mv = new Chess(parent.fen).move(current.move);
      return [mv.from as Key, mv.to as Key];
    } catch {
      return undefined;
    }
  }, [tree, path, current, atRoot]);

  const play = useCallback(
    (orig: Key, dest: Key) => {
      const chess = new Chess(currentFen);
      let san: string;
      try {
        san = chess.move({ from: orig, to: dest, promotion: "q" }).san;
      } catch {
        return; // ilegal
      }
      setTree((prev) => {
        const { tree: next, childIndex } = addChildMove(
          prev,
          path,
          san,
          chess.fen(),
        );
        if (childIndex >= 0) setPath([...path, childIndex]);
        return next;
      });
    },
    [currentFen, path],
  );

  const goToPath = useCallback((p: NodePath) => setPath(p), []);
  const back = useCallback(() => setPath((p) => p.slice(0, -1)), []);
  const reset = useCallback(() => setPath([]), []);

  const setColor = useCallback(
    (color: NodeColor | null) => setTree((prev) => setColorAtPath(prev, path, color)),
    [path],
  );
  const setNote = useCallback(
    (note: string) =>
      setTree((prev) => setNoteAtPath(prev, path, note.trim() || null)),
    [path],
  );
  const deleteCurrent = useCallback(() => {
    setTree((prev) => deleteAtPath(prev, path));
    setPath((p) => p.slice(0, -1));
  }, [path]);

  return {
    tree,
    path,
    current,
    currentFen,
    atRoot,
    dests,
    lastMove,
    play,
    goToPath,
    back,
    reset,
    setColor,
    setNote,
    deleteCurrent,
  };
}
