import { useEffect, useRef, useState } from "react";
import Chessground from "../board/Chessground.tsx";
import { rateCard } from "./fsrs.ts";
import { getDueStudyCards, getDueTagCounts, type StudyCard } from "./repo.ts";
import { listTags } from "../tags/repo.ts";
import { videoUrlAt } from "../lib/video.ts";
import { categoryChip } from "../tags/categories.ts";
import type { ReviewRating, Tag } from "../db/schema.ts";

const RATINGS: Array<{ value: ReviewRating; label: string; className: string }> = [
  { value: 1, label: "Otra vez", className: "bg-red-600 active:bg-red-700" },
  { value: 2, label: "Difícil", className: "bg-amber-600 active:bg-amber-700" },
  { value: 3, label: "Bien", className: "bg-emerald-600 active:bg-emerald-700" },
  { value: 4, label: "Fácil", className: "bg-sky-600 active:bg-sky-700" },
];

export default function StudyPage() {
  const [queue, setQueue] = useState<StudyCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewedCount, setReviewedCount] = useState(0);
  // null = "todas" (intercalado); string = bloque por ese tag.
  const [mode, setMode] = useState<string | null>(null);
  const [tagsById, setTagsById] = useState<Map<string, Tag>>(new Map());
  const [dueCounts, setDueCounts] = useState<Map<string, number>>(new Map());
  const shownAt = useRef<number>(Date.now());

  async function loadQueue(tagId: string | null) {
    setLoading(true);
    const cards = await getDueStudyCards(tagId ? { tagId } : {});
    setQueue(cards);
    setIndex(0);
    setRevealed(false);
    setReviewedCount(0);
    setLoading(false);
    shownAt.current = Date.now();
  }

  // Carga inicial: tags, conteos por tema y la cola intercalada.
  useEffect(() => {
    void (async () => {
      const [tags, counts] = await Promise.all([listTags(), getDueTagCounts()]);
      setTagsById(new Map(tags.map((t) => [t.id, t])));
      setDueCounts(counts);
      await loadQueue(null);
    })();
  }, []);

  function selectMode(tagId: string | null) {
    setMode(tagId);
    void loadQueue(tagId);
  }

  const current = queue[index];

  async function onRate(rating: ReviewRating) {
    if (!current) return;
    const elapsedMs = Date.now() - shownAt.current;
    await rateCard(current.card, rating, elapsedMs);
    setReviewedCount((n) => n + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
    shownAt.current = Date.now();
  }

  const dueTags = [...dueCounts.entries()]
    .map(([id, count]) => ({ tag: tagsById.get(id), count }))
    .filter((x): x is { tag: Tag; count: number } => !!x.tag)
    .sort((a, b) => a.tag.name.localeCompare(b.tag.name, "es"));

  const modeSelector = (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => selectMode(null)}
        className={`rounded-full border px-3 py-1 text-xs ${
          mode === null
            ? "border-emerald-500 bg-emerald-600 text-white"
            : "border-gray-600 text-gray-300"
        }`}
      >
        Todas (intercalado)
      </button>
      {dueTags.map(({ tag, count }) => (
        <button
          key={tag.id}
          type="button"
          onClick={() => selectMode(tag.id)}
          className={`rounded-full border px-3 py-1 text-xs ${
            mode === tag.id
              ? "border-emerald-500 bg-emerald-600 text-white"
              : categoryChip(tag.category)
          }`}
        >
          {tag.name} · {count}
        </button>
      ))}
    </div>
  );

  if (loading) return <p className="text-sm text-gray-400">Cargando…</p>;

  if (!current) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Estudiar</h1>
        {modeSelector}
        <div className="space-y-2 pt-6 text-center">
          <p className="text-2xl">✅</p>
          <p className="font-medium">No hay más tarjetas por ahora.</p>
          {reviewedCount > 0 && (
            <p className="text-sm text-gray-400">
              Repasaste {reviewedCount} {reviewedCount === 1 ? "tarjeta" : "tarjetas"}.
            </p>
          )}
        </div>
      </div>
    );
  }

  const { position, tagIds } = current;
  const orientation = position.side_to_move === "b" ? "black" : "white";
  const cardTags = tagIds
    .map((id) => tagsById.get(id))
    .filter((t): t is Tag => !!t);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Estudiar</h1>
        <span className="text-sm text-gray-400">
          {index + 1}/{queue.length}
        </span>
      </div>

      {modeSelector}

      <Chessground fen={position.fen} orientation={orientation} viewOnly />

      <p className="text-center text-sm text-gray-300">
        Juegan {position.side_to_move === "b" ? "negras" : "blancas"} · ¿cuál es la idea?
      </p>

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

          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => onRate(r.value)}
                className={`rounded-lg px-2 py-3 text-xs font-medium text-white ${r.className}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
