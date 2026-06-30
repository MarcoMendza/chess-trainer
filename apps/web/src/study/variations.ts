import { db } from "../db/db.ts";
import { newRow, touch } from "../db/helpers.ts";
import type { NodeColor, Variation, VariationNode } from "../db/schema.ts";

/** Ruta a un nodo: índices de hijo desde la raíz. `[]` = la raíz. */
export type NodePath = number[];

// ===== Helpers puros del árbol =====

/** Árbol nuevo: solo la raíz con el FEN de la tarjeta. */
export function createTree(fen: string): VariationNode {
  return { move: null, fen, color: null, note: null, children: [] };
}

/** ¿El árbol tiene al menos una jugada candidata? (para decidir si vale la pena guardarlo) */
export function hasMoves(tree: VariationNode | null | undefined): boolean {
  return !!tree && tree.children.length > 0;
}

/** Nodo en una ruta, o null si la ruta no existe. */
export function nodeAtPath(
  tree: VariationNode,
  path: NodePath,
): VariationNode | null {
  let node: VariationNode = tree;
  for (const i of path) {
    const next = node.children[i];
    if (!next) return null;
    node = next;
  }
  return node;
}

/** Índice del hijo cuyo SAN coincide, o -1. */
export function childIndexByMove(node: VariationNode, san: string): number {
  return node.children.findIndex((c) => c.move === san);
}

/**
 * Hijos "principales" de un nodo (para el modo estricto):
 * los marcados `main`; si ninguno lo está, el primer hijo como fallback.
 */
export function principalChildren(node: VariationNode): VariationNode[] {
  const main = node.children.filter((c) => c.color === "main");
  if (main.length) return main;
  return node.children.length ? [node.children[0]] : [];
}

/**
 * Ruta resultante de reproducir una secuencia de SAN desde la raíz.
 * Devuelve null si en algún punto la jugada se sale del árbol.
 */
export function pathFromSans(
  tree: VariationNode,
  sans: string[],
): NodePath | null {
  let node = tree;
  const path: NodePath = [];
  for (const san of sans) {
    const idx = childIndexByMove(node, san);
    if (idx < 0) return null;
    path.push(idx);
    node = node.children[idx];
  }
  return path;
}

// --- Mutaciones inmutables (clonan y devuelven un árbol nuevo) ---

function clone(tree: VariationNode): VariationNode {
  return structuredClone(tree);
}

/**
 * Agrega (o reutiliza) una jugada como hijo del nodo en `path`.
 * Si ya existe un hijo con ese SAN, no duplica. Devuelve el árbol nuevo y el
 * índice del hijo (para navegar hacia él).
 */
export function addChildMove(
  tree: VariationNode,
  path: NodePath,
  san: string,
  fen: string,
): { tree: VariationNode; childIndex: number } {
  const next = clone(tree);
  const node = nodeAtPath(next, path);
  if (!node) return { tree, childIndex: -1 };
  const existing = childIndexByMove(node, san);
  if (existing >= 0) return { tree: next, childIndex: existing };
  node.children.push({ move: san, fen, color: null, note: null, children: [] });
  return { tree: next, childIndex: node.children.length - 1 };
}

export function setColorAtPath(
  tree: VariationNode,
  path: NodePath,
  color: NodeColor | null,
): VariationNode {
  const next = clone(tree);
  const node = nodeAtPath(next, path);
  if (node && path.length > 0) node.color = color; // la raíz no lleva color
  return next;
}

export function setNoteAtPath(
  tree: VariationNode,
  path: NodePath,
  note: string | null,
): VariationNode {
  const next = clone(tree);
  const node = nodeAtPath(next, path);
  if (node && path.length > 0) node.note = note;
  return next;
}

/** Borra el nodo en `path` (y su subárbol). No borra la raíz. */
export function deleteAtPath(tree: VariationNode, path: NodePath): VariationNode {
  if (path.length === 0) return tree;
  const next = clone(tree);
  const parent = nodeAtPath(next, path.slice(0, -1));
  if (parent) parent.children.splice(path[path.length - 1], 1);
  return next;
}

// ===== CRUD Dexie =====

/** Árbol (no borrado) de una posición, o undefined. Una variation por position. */
export async function getVariationByPosition(
  positionId: string,
): Promise<Variation | undefined> {
  const rows = await db.variations
    .where("position_id")
    .equals(positionId)
    .filter((v) => v.deleted === 0)
    .toArray();
  return rows[0];
}

/** Soft-delete del árbol de una posición (al editar una tarjeta y borrar todas las jugadas). */
export async function clearVariationByPosition(positionId: string): Promise<void> {
  const existing = await getVariationByPosition(positionId);
  if (existing) await db.variations.put({ ...existing, ...touch(), deleted: 1 });
}

/** Crea o actualiza el árbol de una posición. */
export async function saveVariationTree(
  positionId: string,
  tree: VariationNode,
): Promise<void> {
  const existing = await getVariationByPosition(positionId);
  if (existing) {
    // put (no update): `update` genera un KeyPaths recursivo que no soporta el árbol.
    await db.variations.put({ ...existing, ...touch(), tree });
  } else {
    await db.variations.add({ ...newRow(), position_id: positionId, tree });
  }
}
