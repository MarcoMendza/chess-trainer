import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Chessground from "../board/Chessground.tsx";
import { db } from "../db/db.ts";
import {
  positionsBySubtree,
  positionsWithoutTags,
  tagsForPosition,
} from "../tags/repo.ts";
import { videoUrlAt } from "../lib/video.ts";
import { getVariationByPosition } from "../study/variations.ts";
import { getPosition, softDeleteCard } from "../study/repo.ts";
import SaveCardSheet from "../study/SaveCardSheet.tsx";
import StudyPlayer, { type PlayMode } from "../study/StudyPlayer.tsx";
import type { Position, Tag, VariationNode } from "../db/schema.ts";

/** `untagged`: modo "Sin tema" (tarjetas sueltas), sin `tagId` en la ruta. */
export default function TrainThemePage({ untagged = false }: { untagged?: boolean }) {
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
  // Edición de la ficha actual (reusa SaveCardSheet). `nonce` fuerza recargar su árbol.
  const [editing, setEditing] = useState(false);
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const title = untagged ? "Sin tema" : tag?.name ?? "Tema";

  useEffect(() => {
    void (async () => {
      if (untagged) {
        setPositions(await positionsWithoutTags());
      } else if (tagId) {
        setTag(await db.tags.get(tagId));
        setPositions(await positionsBySubtree(tagId));
      }
      setLoading(false);
    })();
  }, [tagId, untagged]);

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
  }, [currentId, nonce]);

  if (loading) return <p className="text-sm text-gray-400">Cargando…</p>;

  function go(delta: number) {
    setRevealed(false);
    setConfirmDelete(false);
    setIndex((i) => Math.max(0, Math.min(positions.length - 1, i + delta)));
  }

  // Abre el editor con los tags actuales de la ficha (el árbol ya está en estado).
  async function openEditor() {
    if (!current) return;
    const tags = await tagsForPosition(current.id);
    setEditTagIds(tags.map((t) => t.id));
    setEditing(true);
  }

  // Tras guardar: recarga la posición en la lista y refresca su árbol (nonce).
  async function onEdited() {
    if (!current) return;
    const pos = await getPosition(current.id);
    if (pos) setPositions((ps) => ps.map((p, i) => (i === index ? pos : p)));
    setNonce((n) => n + 1);
  }

  // Borra (soft) la ficha actual, la quita de la lista y reencuadra el índice.
  async function onDelete() {
    if (!current) return;
    await softDeleteCard(current.id);
    setConfirmDelete(false);
    setRevealed(false);
    const next = positions.filter((_, i) => i !== index);
    setPositions(next);
    setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
  }

  return (
    <div className="space-y-3">
      <div>
        <Link to="/entrenar" className="text-sm text-gray-400">
          ← Entrenar
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{title}</h1>
      </div>

      {positions.length === 0 || !current ? (
        <p className="text-sm text-gray-400">
          {untagged ? "No hay tarjetas sueltas." : "Este tema no tiene posiciones."}
        </p>
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

          {confirmDelete ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-950/40 px-3 py-2">
              <span className="flex-1 text-sm text-red-200">¿Borrar esta tarjeta?</span>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm active:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void onDelete()}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white active:bg-red-700"
              >
                Borrar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void openEditor()}
                className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm active:bg-gray-700"
              >
                ✎ Editar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex-1 rounded-lg border border-red-800 px-4 py-2 text-sm text-red-300 active:bg-red-950/40"
              >
                🗑 Borrar
              </button>
            </div>
          )}

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

          {editing && (
            <SaveCardSheet
              fen={current.fen}
              position={current}
              initialTree={tree}
              initialTagIds={editTagIds}
              onClose={() => setEditing(false)}
              onSaved={() => void onEdited()}
            />
          )}
        </>
      )}
    </div>
  );
}
