import { useEffect, useRef, useState } from "react";
import Chessground from "../board/Chessground.tsx";
import { rateCard } from "./fsrs.ts";
import { getDueStudyCards, type StudyCard } from "./repo.ts";
import type { ReviewRating } from "../db/schema.ts";

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
  const shownAt = useRef<number>(Date.now());

  useEffect(() => {
    void (async () => {
      setQueue(await getDueStudyCards());
      setLoading(false);
      shownAt.current = Date.now();
    })();
  }, []);

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

  if (loading) return <p className="text-sm text-gray-400">Cargando…</p>;

  if (!current) {
    return (
      <div className="space-y-2 pt-8 text-center">
        <p className="text-2xl">✅</p>
        <p className="font-medium">No hay más tarjetas por hoy.</p>
        {reviewedCount > 0 && (
          <p className="text-sm text-gray-400">
            Repasaste {reviewedCount} {reviewedCount === 1 ? "tarjeta" : "tarjetas"}.
          </p>
        )}
      </div>
    );
  }

  const { position } = current;
  const orientation = position.side_to_move === "b" ? "black" : "white";

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Estudiar</h1>
        <span className="text-sm text-gray-400">
          {index + 1}/{queue.length}
        </span>
      </div>

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
          <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
            {position.idea && <p className="text-sm">{position.idea}</p>}
            {position.eval_note && (
              <p className="mt-2 text-xs text-gray-400">{position.eval_note}</p>
            )}
            {position.card_type === "best_move" && position.best_move && (
              <p className="mt-2 text-sm font-medium text-emerald-400">
                Mejor jugada: {position.best_move}
              </p>
            )}
            {!position.idea && !position.eval_note && (
              <p className="text-sm text-gray-400">(Sin nota para esta posición.)</p>
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
