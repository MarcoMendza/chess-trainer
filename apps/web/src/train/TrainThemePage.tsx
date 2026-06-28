import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Chessground from "../board/Chessground.tsx";
import { db } from "../db/db.ts";
import { positionsBySubtree } from "../tags/repo.ts";
import { videoUrlAt } from "../lib/video.ts";
import { getVariationByPosition } from "../study/variations.ts";
import StudyPlayer, { type PlayMode } from "../study/StudyPlayer.tsx";
import type { Position, Tag, VariationNode } from "../db/schema.ts";

export default function TrainThemePage() {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate = useNavigate();
  const [tag, setTag] = useState<Tag | undefined>();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // Árbol de variantes de la posición actual (null = sin árbol). Modo de juego por sesión.
  const [tree, setTree] = useState<VariationNode | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>("color");

  useEffect(() => {
    if (!tagId) return;
    void (async () => {
      setTag(await db.tags.get(tagId));
      setPositions(await positionsBySubtree(tagId));
      setLoading(false);
    })();
  }, [tagId]);

  const current = positions[index];

  // Carga el árbol de variantes de la posición actual (si tiene), igual que Estudiar.
  const currentId = current?.id;
  useEffect(() => {
    let cancelled = false;
    setTree(null);
    if (!currentId) return;
    void (async () => {
      const variation = await getVariationByPosition(currentId);
      if (!cancelled) setTree(variation?.tree ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentId]);

  if (loading) return <p className="text-sm text-gray-400">Cargando…</p>;

  function go(delta: number) {
    setRevealed(false);
    setIndex((i) => Math.max(0, Math.min(positions.length - 1, i + delta)));
  }

  return (
    <div className="space-y-3">
      <div>
        <Link to="/entrenar" className="text-sm text-gray-400">
          ← Entrenar
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{tag?.name ?? "Tema"}</h1>
      </div>

      {positions.length === 0 || !current ? (
        <p className="text-sm text-gray-400">Este tema no tiene posiciones.</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between text-sm text-gray-400">
            <span>Repaso libre (sin SRS)</span>
            <span>
              {index + 1}/{positions.length}
            </span>
          </div>

          {tree ? (
            <StudyPlayer
              key={current.id}
              rootFen={current.fen}
              tree={tree}
              orientation={current.side_to_move === "b" ? "black" : "white"}
              mode={playMode}
              onModeChange={setPlayMode}
              onAnalyze={(fen) => navigate("/analizar", { state: { fen } })}
            />
          ) : (
            <>
              <Chessground
                fen={current.fen}
                orientation={current.side_to_move === "b" ? "black" : "white"}
                viewOnly
              />

              <p className="text-center text-sm text-gray-300">
                Juegan {current.side_to_move === "b" ? "negras" : "blancas"} · ¿cuál es la idea?
              </p>
            </>
          )}

          {/* Altura reservada: al revelar/ocultar y al cambiar de tarjeta los botones
              de navegación de abajo no brincan (la idea suele caber en este alto). */}
          <div className="min-h-[7rem]">
            {!revealed ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="w-full rounded-lg bg-gray-700 px-4 py-3 text-sm font-medium active:bg-gray-600"
              >
                Revelar idea
              </button>
            ) : (
              <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-800 p-4">
                {current.idea && <p className="text-sm">{current.idea}</p>}
                {current.eval_note && (
                  <p className="text-xs text-gray-400">{current.eval_note}</p>
                )}
                {!current.idea && !current.eval_note && (
                  <p className="text-sm text-gray-400">(Sin nota para esta posición.)</p>
                )}
                {current.source_url && (
                  <a
                    href={videoUrlAt(current.source_url, current.source_time)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white active:bg-red-700"
                  >
                    ▶ Ver video{current.source_time ? ` · ${current.source_time}` : ""}
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={index === 0}
              className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm active:bg-gray-700 disabled:opacity-30"
            >
              ◀ Anterior
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index === positions.length - 1}
              className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm active:bg-gray-700 disabled:opacity-30"
            >
              Siguiente ▶
            </button>
          </div>
        </>
      )}
    </div>
  );
}
