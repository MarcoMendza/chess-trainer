import { useEffect, useRef } from "react";
import { Chessground as createChessground } from "chessground";
import type { Api } from "chessground/api";
import type { Config } from "chessground/config";
import type { DrawShape } from "chessground/draw";
import type { Key } from "chessground/types";

export interface BoardProps {
  /** FEN a mostrar. */
  fen: string;
  orientation?: "white" | "black";
  /** Solo lectura: sin arrastrar piezas (tarjetas de estudio, vista de partida). */
  viewOnly?: boolean;
  /** Color que tiene el turno (para colorear/permitir el arrastre). */
  turnColor?: "white" | "black";
  /** Movimientos legales por casilla origen. Si se omite, no se puede mover. */
  dests?: Map<Key, Key[]>;
  /** Último movimiento [from, to] para resaltarlo. */
  lastMove?: [Key, Key];
  /** Formas dibujadas por la app (p. ej. flecha de mejor jugada del motor). */
  autoShapes?: DrawShape[];
  /** Callback al soltar una pieza en destino legal. */
  onMove?: (orig: Key, dest: Key) => void;
}

/**
 * Wrapper React fino sobre chessground (el tablero de Lichess, vanilla JS).
 * Crea la instancia una vez y la reconfigura con `api.set` cuando cambian las props.
 */
export default function Chessground({
  fen,
  orientation = "white",
  viewOnly = false,
  turnColor,
  dests,
  lastMove,
  autoShapes,
  onMove,
}: BoardProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  // onMove puede cambiar en cada render; lo leemos por ref para no recrear el tablero.
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  // Crear / destruir la instancia.
  useEffect(() => {
    if (!elRef.current) return;
    const api = createChessground(elRef.current, { coordinates: true });
    apiRef.current = api;
    return () => {
      api.destroy();
      apiRef.current = null;
    };
  }, []);

  // Sincronizar config con las props.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const config: Config = {
      fen,
      orientation,
      viewOnly,
      turnColor,
      lastMove,
      movable: {
        free: false,
        color: viewOnly ? undefined : turnColor,
        dests: dests ?? new Map(),
        showDests: true,
        events: {
          after: (orig, dest) => onMoveRef.current?.(orig, dest),
        },
      },
      draggable: { enabled: !viewOnly },
      drawable: { enabled: true, autoShapes: autoShapes ?? [] },
    };
    api.set(config);
  }, [fen, orientation, viewOnly, turnColor, dests, lastMove, autoShapes]);

  // Contenedor cuadrado responsivo; chessground monta dentro del div interno.
  return (
    <div className="aspect-square w-full">
      <div ref={elRef} className="h-full w-full" />
    </div>
  );
}
