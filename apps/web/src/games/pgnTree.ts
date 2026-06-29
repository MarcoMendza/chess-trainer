import { Chess } from "chess.js";
import type { VariationNode } from "../db/schema.ts";

// Serialización árbol de variantes ⇄ PGN (Fase Anotar §5). chess.js 1.x lee/escribe
// comentarios {…} pero DESCARTA las variantes (RAVs): por eso aquí generamos y parseamos
// el movetext con sidelines a mano. chess.js se usa solo para validar jugadas y dar FENs.
//
// Módulo PURO (sin Dexie) a propósito: así el round-trip se puede testear en node.

// ===== Helpers de árbol (copia local mínima para no arrastrar dependencias de db) =====

export function createTree(fen: string): VariationNode {
  return { move: null, fen, color: null, note: null, children: [] };
}

function nodeAtPath(tree: VariationNode, path: number[]): VariationNode | null {
  let node: VariationNode = tree;
  for (const i of path) {
    const next = node.children[i];
    if (!next) return null;
    node = next;
  }
  return node;
}

interface Meta {
  side: "w" | "b";
  moveNo: number;
}

function fenMeta(fen: string): Meta {
  const parts = fen.split(" ");
  return {
    side: parts[1] === "b" ? "b" : "w",
    moveNo: Number.parseInt(parts[5] ?? "1", 10) || 1,
  };
}

function advance(meta: Meta): Meta {
  return meta.side === "w"
    ? { side: "b", moveNo: meta.moveNo }
    : { side: "w", moveNo: meta.moveNo + 1 };
}

// ===== Árbol → movetext PGN (sidelines + comentarios) =====

/** Quita llaves de una nota (no pueden aparecer dentro de un comentario PGN). */
function safeComment(note: string): string {
  return note.replace(/[{}]/g, "").trim();
}

/** Número de jugada + SAN como tokens (negras solo numeradas si `force`). */
function moveTokens(node: VariationNode, meta: Meta, force: boolean): string[] {
  const san = node.move ?? "";
  if (meta.side === "w") return [`${meta.moveNo}.`, san];
  return force ? [`${meta.moveNo}...`, san] : [san];
}

/**
 * Tokens del subárbol bajo `node`: hijo 0 = línea principal; hijos 1.. = variantes
 * (entre paréntesis, alternativas al hijo 0). Misma estructura que VariationTree.
 */
function lineTokens(
  node: VariationNode,
  metaBefore: Meta,
  forceNumberFirst: boolean,
): string[] {
  if (node.children.length === 0) return [];
  const out: string[] = [];
  const main = node.children[0];
  const branches = node.children.slice(1);

  out.push(...moveTokens(main, metaBefore, forceNumberFirst));
  if (main.note) out.push(`{${safeComment(main.note)}}`);

  for (const b of branches) {
    out.push("(");
    out.push(...moveTokens(b, metaBefore, true));
    if (b.note) out.push(`{${safeComment(b.note)}}`);
    out.push(...lineTokens(b, advance(metaBefore), false));
    out.push(")");
  }

  // Reanuda la principal; tras una rama hay que repetir el número de jugada.
  out.push(...lineTokens(main, advance(metaBefore), branches.length > 0));
  return out;
}

/** Movetext PGN del árbol (sin cabeceras ni resultado). Vacío si no hay jugadas. */
export function treeToMovetext(root: VariationNode): string {
  const tokens = lineTokens(root, fenMeta(root.fen), true);
  return tokens
    .join(" ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function escapeTag(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export interface PgnGameInput {
  tree: VariationNode;
  white?: string;
  black?: string;
  result?: string; // 1-0 | 0-1 | 1/2-1/2 | *
  date?: string; // YYYY.MM.DD
  round?: string;
  eco?: string;
  event?: string;
  generalNote?: string; // comentario general (va antes de la jugada 1)
}

/** Árbol + datos → PGN completo (cabeceras + nota general + movetext + resultado). */
export function treeToPgn(input: PgnGameInput): string {
  const result = input.result || "*";
  const headers: Array<[string, string]> = [
    ["Event", input.event || "?"],
    ["Site", "?"],
    ["Date", input.date || "????.??.??"],
    ["Round", input.round || "?"],
    ["White", input.white || "?"],
    ["Black", input.black || "?"],
    ["Result", result],
  ];
  if (input.eco) headers.push(["ECO", input.eco]);
  const headerStr = headers
    .map(([k, v]) => `[${k} "${escapeTag(v)}"]`)
    .join("\n");

  let movetext = treeToMovetext(input.tree);
  const note = input.generalNote ? safeComment(input.generalNote) : "";
  if (note) movetext = movetext ? `{${note}} ${movetext}` : `{${note}}`;

  const body = `${movetext} ${result}`.trim();
  return `${headerStr}\n\n${body}\n`;
}

// ===== PGN → árbol (re-lectura con sidelines + comentarios) =====

type Token =
  | { t: "san"; v: string }
  | { t: "comment"; v: string }
  | { t: "open" }
  | { t: "close" }
  | { t: "result"; v: string };

const RESULTS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);

/** Quita las líneas de cabecera ([Tag "x"]) y deja solo el movetext. */
function stripHeaders(pgn: string): string {
  return pgn
    .split("\n")
    .filter((l) => !/^\s*\[.*\]\s*$/.test(l))
    .join("\n")
    .trim();
}

function tokenize(movetext: string): Token[] {
  const toks: Token[] = [];
  let i = 0;
  while (i < movetext.length) {
    const ch = movetext[i];
    if (ch === "{") {
      let j = movetext.indexOf("}", i + 1);
      if (j < 0) j = movetext.length;
      toks.push({ t: "comment", v: movetext.slice(i + 1, j).trim() });
      i = j + 1;
      continue;
    }
    if (ch === ";") {
      // comentario de línea hasta fin de renglón
      let j = movetext.indexOf("\n", i);
      if (j < 0) j = movetext.length;
      toks.push({ t: "comment", v: movetext.slice(i + 1, j).trim() });
      i = j + 1;
      continue;
    }
    if (ch === "(") {
      toks.push({ t: "open" });
      i++;
      continue;
    }
    if (ch === ")") {
      toks.push({ t: "close" });
      i++;
      continue;
    }
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    // Palabra: hasta espacio o delimitador.
    let j = i;
    while (j < movetext.length && !/[\s(){};]/.test(movetext[j])) j++;
    const word = movetext.slice(i, j);
    i = j;
    if (RESULTS.has(word)) {
      toks.push({ t: "result", v: word });
      continue;
    }
    if (/^\$\d+$/.test(word)) continue; // NAG: ignorar
    // Quita prefijo de número de jugada ("12." | "12..." | adosado a la jugada).
    let san = word.replace(/^\d+\.(\.\.)?/, "");
    if (san === "") continue; // era solo el número
    san = san.replace(/[!?]+$/, ""); // glifos de anotación al final
    if (san) toks.push({ t: "san", v: san });
  }
  return toks;
}

export interface ParsedGame {
  root: VariationNode;
  generalNote: string | null;
}

/**
 * PGN (o movetext) → árbol de variantes. Valida cada jugada con chess.js (una instancia
 * por línea) y reconstruye las ramas con una pila para `(`/`)`. Lanza si el PGN es
 * irrecuperable; el llamador debe tener un fallback.
 */
export function pgnToTree(pgn: string, startFen: string = START_FEN): ParsedGame {
  const toks = tokenize(stripHeaders(pgn));
  const root = createTree(startFen);
  const parentOf = new Map<VariationNode, VariationNode>();
  const stack: Array<{ cursor: VariationNode; chess: Chess }> = [];
  let cursor = root;
  let chess = new Chess(startFen);
  let generalNote: string | null = null;

  for (const tk of toks) {
    if (tk.t === "result") break;
    if (tk.t === "comment") {
      if (cursor === root && stack.length === 0) {
        generalNote = generalNote ? `${generalNote} ${tk.v}` : tk.v;
      } else {
        cursor.note = cursor.note ? `${cursor.note} ${tk.v}` : tk.v;
      }
      continue;
    }
    if (tk.t === "open") {
      stack.push({ cursor, chess });
      const parent = parentOf.get(cursor) ?? root;
      cursor = parent;
      chess = new Chess(parent.fen);
      continue;
    }
    if (tk.t === "close") {
      const s = stack.pop();
      if (s) {
        cursor = s.cursor;
        chess = s.chess;
      }
      continue;
    }
    // san
    let mv;
    try {
      mv = chess.move(tk.v);
    } catch {
      mv = null;
    }
    if (!mv) continue; // jugada ilegal: la saltamos (defensivo)
    const child: VariationNode = {
      move: mv.san,
      fen: chess.fen(),
      color: null,
      note: null,
      children: [],
    };
    cursor.children.push(child);
    parentOf.set(child, cursor);
    cursor = child;
  }

  return { root, generalNote };
}

// ===== Promover a principal (estilo ChessBase) =====

/**
 * Mueve el nodo en `path` al primer lugar entre sus hermanos: esa rama pasa a ser la
 * línea principal en su punto de divergencia y la anterior queda como variante.
 */
export function promoteAtPath(
  tree: VariationNode,
  path: number[],
): VariationNode {
  if (path.length === 0) return tree;
  const next = structuredClone(tree);
  const parent = nodeAtPath(next, path.slice(0, -1));
  if (!parent) return next;
  const idx = path[path.length - 1];
  if (idx <= 0 || idx >= parent.children.length) return next; // ya es principal o inválido
  const [child] = parent.children.splice(idx, 1);
  parent.children.unshift(child);
  return next;
}
