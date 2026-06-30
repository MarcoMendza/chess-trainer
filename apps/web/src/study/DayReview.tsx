import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rateCard } from "./fsrs.ts";
import {
  getDayReviewQueue,
  getPosition,
  type StudyCard as StudyCardData,
} from "./repo.ts";
import { listTags, tagsForPosition } from "../tags/repo.ts";
import { useCardTree } from "./useCardTree.ts";
import StudyCard from "./StudyCard.tsx";
import type { PlayMode } from "./StudyPlayer.tsx";
import {
  getSettings,
  incNewDone,
  needsNewPrompt,
  remainingNew,
  setNewGoalToday,
} from "./settings.ts";
import type { ReviewRating, Tag } from "../db/schema.ts";

const RATINGS: Array<{ value: ReviewRating; label: string; className: string }> = [
  { value: 1, label: "Otra vez", className: "bg-red-600 active:bg-red-700" },
  { value: 2, label: "Difícil", className: "bg-amber-600 active:bg-amber-700" },
  { value: 3, label: "Bien", className: "bg-emerald-600 active:bg-emerald-700" },
  { value: 4, label: "Fácil", className: "bg-sky-600 active:bg-sky-700" },
];

const PRESETS = [10, 15, 20];

/**
 * Repaso del día (Fase Estudiar §2/§3): cola única intercalada de lo que vence hoy.
 * Los repasos vencidos van completos; las tarjetas nuevas se limitan al cupo elegido en
 * el prompt "¿cuántas nuevas hoy?". Mueve el calendario FSRS.
 */
export default function DayReview() {
  const [queue, setQueue] = useState<StudyCardData[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [tagsById, setTagsById] = useState<Map<string, Tag>>(new Map());
  const [playMode, setPlayMode] = useState<PlayMode>("color");
  // Prompt de nuevas: null = aún no decidido este montaje; default recordado en `promptDefault`.
  const [needPrompt, setNeedPrompt] = useState(false);
  const [promptDefault, setPromptDefault] = useState(10);
  const [otra, setOtra] = useState("");
  const shownAt = useRef<number>(Date.now());
  const navigate = useNavigate();

  async function loadQueue(newLimit: number) {
    setLoading(true);
    const cards = await getDayReviewQueue({ newLimit });
    setQueue(cards);
    setIndex(0);
    setReviewedCount(0);
    setLoading(false);
    shownAt.current = Date.now();
  }

  useEffect(() => {
    void (async () => {
      const [tags, s] = await Promise.all([listTags(), getSettings()]);
      setTagsById(new Map(tags.map((t) => [t.id, t])));
      setPromptDefault(s.newPerDayDefault);
      setOtra(String(s.newPerDayDefault));
      if (needsNewPrompt(s)) {
        setNeedPrompt(true);
        setLoading(false);
      } else {
        await loadQueue(remainingNew(s));
      }
    })();
  }, []);

  async function chooseNew(n: number) {
    const goal = Math.max(0, Math.floor(n));
    const s = await setNewGoalToday(goal);
    setNeedPrompt(false);
    await loadQueue(remainingNew(s));
  }

  const [cardNonce, setCardNonce] = useState(0);
  const current = queue[index];
  const tree = useCardTree(current?.position.id, cardNonce);

  // Tras editar la tarjeta actual: recarga su posición/tags en la cola y refresca el árbol.
  async function onEdited() {
    if (!current) return;
    const [pos, tg, tags] = await Promise.all([
      getPosition(current.position.id),
      tagsForPosition(current.position.id),
      listTags(),
    ]);
    setTagsById(new Map(tags.map((t) => [t.id, t])));
    if (pos) {
      const tagIds = tg.map((t) => t.id);
      setQueue((q) =>
        q.map((c, i) =>
          i === index ? { ...c, position: pos, tagIds } : c,
        ),
      );
    }
    setCardNonce((n) => n + 1);
  }

  async function onRate(rating: ReviewRating) {
    if (!current) return;
    const elapsedMs = Date.now() - shownAt.current;
    const wasNew = current.card.state === "new";
    await rateCard(current.card, rating, elapsedMs);
    if (wasNew) await incNewDone(); // descuenta del cupo de nuevas del día
    setReviewedCount((n) => n + 1);
    setIndex((i) => i + 1);
    shownAt.current = Date.now();
  }

  if (loading) return <p className="text-sm text-gray-400">Cargando…</p>;

  if (needPrompt) {
    return (
      <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-800 p-4">
        <p className="font-medium">¿Cuántas tarjetas nuevas hoy?</p>
        <p className="text-xs text-gray-400">
          Los repasos vencidos se muestran completos; esto controla solo las nuevas.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => void chooseNew(n)}
              className={`rounded-lg px-3 py-3 text-sm font-medium ${
                n === promptDefault
                  ? "bg-emerald-600 text-white active:bg-emerald-700"
                  : "border border-gray-600 active:bg-gray-700"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={otra}
            onChange={(e) => setOtra(e.target.value)}
            className="w-24 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => void chooseNew(Number(otra) || 0)}
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm active:bg-gray-700"
          >
            Otra cantidad
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="space-y-2 pt-6 text-center">
        <p className="text-2xl">✅</p>
        <p className="font-medium">Terminaste el repaso de hoy.</p>
        {reviewedCount > 0 && (
          <p className="text-sm text-gray-400">
            Repasaste {reviewedCount} {reviewedCount === 1 ? "tarjeta" : "tarjetas"}.
          </p>
        )}
      </div>
    );
  }

  const cardTags = current.tagIds
    .map((id) => tagsById.get(id))
    .filter((t): t is Tag => !!t);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-emerald-400">Repaso del día</span>
        <span className="text-sm text-gray-400">
          {index + 1}/{queue.length}
        </span>
      </div>

      <StudyCard
        key={current.position.id}
        position={current.position}
        tree={tree}
        cardTags={cardTags}
        playMode={playMode}
        onPlayModeChange={setPlayMode}
        onAnalyze={(fen) => navigate("/analizar", { state: { fen } })}
        onEdited={() => void onEdited()}
        footer={
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => void onRate(r.value)}
                className={`rounded-lg px-2 py-3 text-xs font-medium text-white ${r.className}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />
    </div>
  );
}
