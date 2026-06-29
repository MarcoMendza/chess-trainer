import { useEffect, useState } from "react";
import { getVariationByPosition } from "./variations.ts";
import type { VariationNode } from "../db/schema.ts";

/**
 * Carga el árbol de variantes de una posición desde la base (null = sin árbol).
 * Reinicia a null al cambiar de posición y cancela cargas obsoletas. Lo usan tanto el
 * repaso del día como la práctica para decidir si pintan StudyPlayer o tablero simple.
 */
export function useCardTree(positionId: string | undefined): VariationNode | null {
  const [tree, setTree] = useState<VariationNode | null>(null);
  useEffect(() => {
    let cancelled = false;
    setTree(null);
    if (!positionId) return;
    void (async () => {
      const variation = await getVariationByPosition(positionId);
      if (!cancelled) setTree(variation?.tree ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [positionId]);
  return tree;
}
