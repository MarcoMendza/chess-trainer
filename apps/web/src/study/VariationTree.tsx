import { Fragment, type ReactNode } from "react";
import type { NodeColor, VariationNode } from "../db/schema.ts";
import type { NodePath } from "./variations.ts";

/**
 * Árbol de variantes estilo Lichess/ChessBase, legible en móvil.
 * - Línea principal (cadena de primeros hijos) en flujo horizontal con números de jugada.
 * - Subvariantes entre paréntesis; las de primer nivel se indentan en su propia línea
 *   (borde izquierdo), las más profundas van en línea.
 * - Tokens coloreados según la semántica fija (verde/amarillo/rojo/azul).
 * - Notas visibles en cursiva junto a su jugada.
 * - Tocar una jugada salta a esa posición (onSelect con la ruta del nodo).
 */
interface VariationTreeProps {
  tree: VariationNode;
  selectedPath?: NodePath;
  onSelect?: (path: NodePath) => void;
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

/** Avanza el contador de jugadas tras jugar (negras → incrementa el número). */
function advance(meta: Meta): Meta {
  return meta.side === "w"
    ? { side: "b", moveNo: meta.moveNo }
    : { side: "w", moveNo: meta.moveNo + 1 };
}

const COLOR_TEXT: Record<NodeColor, string> = {
  main: "text-emerald-400",
  sub: "text-amber-400",
  bad: "text-red-400",
  conditional: "text-sky-400",
};

function pathsEqual(a: NodePath, b: NodePath | undefined): boolean {
  if (!b || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export default function VariationTree({
  tree,
  selectedPath,
  onSelect,
}: VariationTreeProps) {
  if (tree.children.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        (Sin variantes. Mueve una pieza para empezar la línea.)
      </p>
    );
  }

  function MoveToken({
    node,
    path,
    meta,
    forceNumber,
  }: {
    node: VariationNode;
    path: NodePath;
    meta: Meta;
    forceNumber: boolean;
  }) {
    const selected = pathsEqual(path, selectedPath);
    const number =
      meta.side === "w"
        ? `${meta.moveNo}.`
        : forceNumber
          ? `${meta.moveNo}…`
          : "";
    const colorClass = node.color ? COLOR_TEXT[node.color] : "text-gray-200";
    return (
      <button
        type="button"
        onClick={() => onSelect?.(path)}
        className={`rounded px-1 font-medium tabular-nums ${colorClass} ${
          selected ? "bg-emerald-600/30 ring-1 ring-emerald-500" : "active:bg-gray-700"
        }`}
      >
        {number && <span className="mr-0.5 text-gray-500">{number}</span>}
        {node.move}
      </button>
    );
  }

  function Note({ note }: { note: string }) {
    return (
      <span className="italic text-gray-400">
        {" "}
        {note}
      </span>
    );
  }

  // Renderiza los hijos de `node`: principal (hijo 0) + ramas (hijos 1..n).
  // `metaBefore` = meta de la posición en `node` (antes de su jugada hija).
  // `depth` = nivel de anidamiento de variante (la principal es 0).
  function renderChildren(
    node: VariationNode,
    path: NodePath,
    metaBefore: Meta,
    forceNumberFirst: boolean,
    depth: number,
  ): ReactNode[] {
    if (node.children.length === 0) return [];
    const out: ReactNode[] = [];
    const mainPath = [...path, 0];
    const main = node.children[0];
    const branches = node.children.slice(1);

    // 1. Jugada de la línea principal.
    out.push(
      <Fragment key={`m-${mainPath.join(".")}`}>
        <MoveToken
          node={main}
          path={mainPath}
          meta={metaBefore}
          forceNumber={forceNumberFirst}
        />
        {main.note && <Note note={main.note} />}{" "}
      </Fragment>,
    );

    // 2. Ramas alternativas a la principal (mismo ply).
    branches.forEach((branch, j) => {
      const bPath = [...path, j + 1];
      const childDepth = depth + 1;
      const inner = (
        <>
          (
          <MoveToken
            node={branch}
            path={bPath}
            meta={metaBefore}
            forceNumber={true}
          />
          {branch.note && <Note note={branch.note} />}{" "}
          {renderChildren(branch, bPath, advance(metaBefore), false, childDepth)}
          )
        </>
      );
      // Nivel 1: bloque indentado en su propia línea. Más profundo: en línea.
      if (childDepth === 1) {
        out.push(
          <span
            key={`b-${bPath.join(".")}`}
            className="my-0.5 block border-l-2 border-gray-700 pl-2 text-gray-300"
          >
            {inner}
          </span>,
        );
      } else {
        out.push(
          <span key={`b-${bPath.join(".")}`} className="text-gray-400">
            {inner}{" "}
          </span>,
        );
      }
    });

    // 3. Continuación de la línea principal (si tras una rama, re-muestra el número).
    out.push(
      <Fragment key={`c-${mainPath.join(".")}`}>
        {renderChildren(
          main,
          mainPath,
          advance(metaBefore),
          branches.length > 0,
          depth,
        )}
      </Fragment>,
    );

    return out;
  }

  return (
    <div className="space-y-2">
      <ColorLegend />
      <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-700 bg-gray-800/60 p-3 text-sm leading-7">
        {renderChildren(tree, [], fenMeta(tree.fen), false, 0)}
      </div>
    </div>
  );
}

const LEGEND: Array<{ color: NodeColor; label: string }> = [
  { color: "main", label: "Principal" },
  { color: "sub", label: "Subvariante" },
  { color: "conditional", label: "Condicional" },
  { color: "bad", label: "Mala" },
];

function ColorLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
      {LEGEND.map((l) => (
        <span key={l.color} className="inline-flex items-center gap-1">
          <span className={`font-bold ${COLOR_TEXT[l.color]}`}>●</span>
          {l.label}
        </span>
      ))}
    </div>
  );
}
