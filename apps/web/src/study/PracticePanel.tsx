import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StudyCard from "./StudyCard.tsx";
import { useCardTree } from "./useCardTree.ts";
import type { PlayMode } from "./StudyPlayer.tsx";
import {
  listTags,
  positionsByCategory,
  tagIdsByPosition,
} from "../tags/repo.ts";
import { CATEGORIES, CATEGORY_LABEL, categoryChip } from "../tags/categories.ts";
import type { Position, Tag, TagCategory } from "../db/schema.ts";

/**
 * Modo Práctica (Fase Estudiar §4): por categoría de primer nivel, recorre TODAS las
 * fichas de esa categoría (toquen o no hoy) reusando StudyCard. NO toca el FSRS: no hay
 * calificación, no registra reviews ni reprograma, no consume el cupo de nuevas.
 */
export default function PracticePanel() {
  const [category, setCategory] = useState<TagCategory | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tagsById, setTagsById] = useState<Map<string, Tag>>(new Map());
  const [tagIds, setTagIds] = useState<Map<string, string[]>>(new Map());
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>("color");
  const navigate = useNavigate();

  async function pick(cat: TagCategory) {
    setCategory(cat);
    setLoading(true);
    const [tags, pos] = await Promise.all([listTags(), positionsByCategory(cat)]);
    setTagsById(new Map(tags.map((t) => [t.id, t])));
    setTagIds(await tagIdsByPosition(pos.map((p) => p.id)));
    setPositions(pos);
    setIndex(0);
    setLoading(false);
  }

  function back() {
    setCategory(null);
    setPositions([]);
    setIndex(0);
  }

  const current = positions[index];
  const tree = useCardTree(current?.id);

  // Selector de categoría.
  if (!category) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Práctica · no cuenta para hoy (no mueve el calendario)
        </div>
        <p className="text-sm text-gray-400">Elige una categoría para practicar:</p>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => void pick(c)}
              className={`rounded-lg border px-3 py-3 text-sm font-medium active:bg-gray-700 ${categoryChip(c)}`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <p className="text-sm text-gray-400">Cargando…</p>;

  const cardTags = current
    ? (tagIds.get(current.id) ?? [])
        .map((id) => tagsById.get(id))
        .filter((t): t is Tag => !!t)
    : [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
        Práctica · {CATEGORY_LABEL[category]} · no cuenta para hoy
      </div>

      <div className="flex items-baseline justify-between">
        <button type="button" onClick={back} className="text-sm text-gray-400">
          ← Categorías
        </button>
        {positions.length > 0 && (
          <span className="text-sm text-gray-400">
            {index + 1}/{positions.length}
          </span>
        )}
      </div>

      {!current ? (
        <p className="text-sm text-gray-400">
          No hay fichas en {CATEGORY_LABEL[category]} todavía.
        </p>
      ) : (
        <>
          <StudyCard
            key={current.id}
            position={current}
            tree={tree}
            cardTags={cardTags}
            playMode={playMode}
            onPlayModeChange={setPlayMode}
            onAnalyze={(fen) => navigate("/analizar", { state: { fen } })}
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm active:bg-gray-700 disabled:opacity-30"
            >
              ◀ Anterior
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(positions.length - 1, i + 1))}
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
