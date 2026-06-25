import { createEmptyCard, fsrs, State, type Card as FsrsCard, type Grade } from "ts-fsrs";
import { db } from "../db/db.ts";
import { newId, now } from "../db/helpers.ts";
import type { ReviewRating, SrsCard, SrsState } from "../db/schema.ts";

// Un único scheduler FSRS con parámetros por defecto (bien calibrados).
const scheduler = fsrs();

const STATE_TO_STR: Record<State, SrsState> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

const STR_TO_STATE: Record<SrsState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

/**
 * Reconstruye la `Card` de ts-fsrs desde nuestra fila `srs_cards`.
 * `elapsed_days`/`scheduled_days` no se persisten (el doc no los define): el scheduler
 * recalcula el tiempo transcurrido desde `last_review`, así que aquí van en 0.
 * Una tarjeta sin `stability` se trata como nueva (createEmptyCard).
 */
function toFsrsCard(c: SrsCard): FsrsCard {
  if (c.stability == null || c.difficulty == null) {
    return createEmptyCard(new Date(c.last_review ?? c.created_at));
  }
  return {
    due: new Date(c.due ?? now()),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: c.reps,
    lapses: c.lapses,
    state: STR_TO_STATE[c.state],
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  };
}

/** Campos que cambian en `srs_cards` tras una calificación. */
export type CardUpdate = Pick<
  SrsCard,
  | "state"
  | "due"
  | "stability"
  | "difficulty"
  | "reps"
  | "lapses"
  | "last_review"
  | "updated_at"
>;

/**
 * Califica una tarjeta (1 again … 4 easy): recalcula el estado FSRS, lo persiste en
 * `srs_cards` y añade una fila inmutable a `reviews` (append-only, alimenta el historial).
 * Devuelve la tarjeta actualizada.
 */
export async function rateCard(
  card: SrsCard,
  rating: ReviewRating,
  elapsedMs?: number,
): Promise<SrsCard> {
  const reviewedAt = now();
  const { card: next } = scheduler.next(
    toFsrsCard(card),
    new Date(reviewedAt),
    rating as unknown as Grade,
  );

  const update: CardUpdate = {
    state: STATE_TO_STR[next.state],
    due: next.due.getTime(),
    stability: next.stability,
    difficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
    last_review: reviewedAt,
    updated_at: reviewedAt,
  };

  await db.transaction("rw", db.srs_cards, db.reviews, async () => {
    await db.srs_cards.update(card.id, update);
    await db.reviews.add({
      id: newId(),
      card_id: card.id,
      rating,
      reviewed_at: reviewedAt,
      elapsed_ms: elapsedMs,
    });
  });

  return { ...card, ...update };
}
