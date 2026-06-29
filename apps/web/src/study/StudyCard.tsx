import { type ReactNode, useState } from "react";
import Chessground from "../board/Chessground.tsx";
import StudyPlayer, { type PlayMode } from "./StudyPlayer.tsx";
import { categoryChip } from "../tags/categories.ts";
import { videoUrlAt } from "../lib/video.ts";
import type { Position, Tag, VariationNode } from "../db/schema.ts";

interface StudyCardProps {
  position: Position;
  tree: VariationNode | null;
  /** Tags resueltos de la posición (para los chips del panel revelado). */
  cardTags: Tag[];
  playMode: PlayMode;
  onPlayModeChange: (mode: PlayMode) => void;
  onAnalyze: (fen: string) => void;
  /** Acciones bajo el panel de la idea, solo visibles al revelar (rating FSRS o etiqueta). */
  footer?: ReactNode;
}

/**
 * Tarjeta de estudio: tablero (o StudyPlayer si hay árbol) + "Revelar idea" + panel con
 * idea/eval/tags/video. El estado de revelado es interno; se reinicia al cambiar de
 * posición usando `key={position.id}` en el sitio de uso. La calificación FSRS (u otra
 * acción) se inyecta vía `footer` para reusar la misma tarjeta en repaso y en práctica.
 */
export default function StudyCard({
  position,
  tree,
  cardTags,
  playMode,
  onPlayModeChange,
  onAnalyze,
  footer,
}: StudyCardProps) {
  const [revealed, setRevealed] = useState(false);
  const orientation = position.side_to_move === "b" ? "black" : "white";

  return (
    <>
      {tree ? (
        <StudyPlayer
          rootFen={position.fen}
          tree={tree}
          orientation={orientation}
          mode={playMode}
          onModeChange={onPlayModeChange}
          onAnalyze={onAnalyze}
        />
      ) : (
        <>
          <Chessground fen={position.fen} orientation={orientation} viewOnly />
          <p className="text-center text-sm text-gray-300">
            Juegan {position.side_to_move === "b" ? "negras" : "blancas"} · ¿cuál es la idea?
          </p>
        </>
      )}

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full rounded-lg bg-gray-700 px-4 py-3 text-sm font-medium active:bg-gray-600"
        >
          Revelar idea
        </button>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-800 p-4">
            {position.idea && <p className="text-sm">{position.idea}</p>}
            {position.eval_note && (
              <p className="text-xs text-gray-400">{position.eval_note}</p>
            )}
            {!position.idea && !position.eval_note && (
              <p className="text-sm text-gray-400">(Sin nota para esta posición.)</p>
            )}

            {cardTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {cardTags.map((t) => (
                  <span
                    key={t.id}
                    className={`rounded-full border px-2 py-0.5 text-xs ${categoryChip(t.category)}`}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}

            {position.source_url && (
              <a
                href={videoUrlAt(position.source_url, position.source_time)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white active:bg-red-700"
              >
                ▶ Ver video{position.source_time ? ` · ${position.source_time}` : ""}
              </a>
            )}
          </div>

          {footer}
        </div>
      )}
    </>
  );
}
