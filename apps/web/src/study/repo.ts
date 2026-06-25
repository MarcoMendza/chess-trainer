import { db } from "../db/db.ts";
import { newRow, now } from "../db/helpers.ts";
import type {
  CardType,
  Color,
  Deck,
  Position,
  SrsCard,
} from "../db/schema.ts";

export interface StudyCard {
  card: SrsCard;
  position: Position;
}

/** Lado a mover deducido del FEN (campo 2). */
function sideToMove(fen: string): Color {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

// ===== Mazos =====

export async function getOrCreateDeck(
  name: string,
  description?: string,
): Promise<Deck> {
  const existing = await db.decks.where("deleted").equals(0).toArray();
  const found = existing.find((d) => d.name === name);
  if (found) return found;
  const deck: Deck = { ...newRow(), name, description };
  await db.decks.add(deck);
  return deck;
}

// ===== Crear posición + tarjeta =====

export interface NewCardInput {
  fen: string;
  deckId: string | null;
  gameId?: string | null;
  cardType?: CardType;
  idea?: string;
  evalNote?: string;
  bestMove?: string;
  ply?: number;
}

/**
 * Crea una `position` y su `srs_card` asociada (estado `new`, vencida ahora para que
 * aparezca en el primer repaso). Devuelve la tarjeta creada.
 */
export async function createPositionWithCard(input: NewCardInput): Promise<SrsCard> {
  const position: Position = {
    ...newRow(),
    fen: input.fen,
    game_id: input.gameId ?? null,
    ply: input.ply,
    side_to_move: sideToMove(input.fen),
    card_type: input.cardType ?? "idea",
    idea: input.idea,
    eval_note: input.evalNote,
    best_move: input.bestMove,
  };
  const card: SrsCard = {
    ...newRow(),
    position_id: position.id,
    deck_id: input.deckId,
    state: "new",
    due: now(), // vencida de inmediato
    reps: 0,
    lapses: 0,
  };
  await db.transaction("rw", db.positions, db.srs_cards, async () => {
    await db.positions.add(position);
    await db.srs_cards.add(card);
  });
  return card;
}

/** Guarda un FEN suelto como tarjeta de estudio en el mazo "Posiciones sueltas". */
export async function saveLooseFen(fen: string, idea?: string): Promise<SrsCard> {
  const deck = await getOrCreateDeck(
    "Posiciones sueltas",
    "FENs cargados a mano para estudiar.",
  );
  return createPositionWithCard({ fen, deckId: deck.id, idea });
}

// ===== Consultas de repaso =====

/** Tarjetas vencidas (due <= ahora) no borradas, con su posición, ordenadas por due. */
export async function getDueStudyCards(limit = 50): Promise<StudyCard[]> {
  const ts = now();
  const cards = await db.srs_cards
    .where("due")
    .belowOrEqual(ts)
    .filter((c) => c.deleted === 0)
    .sortBy("due");

  const result: StudyCard[] = [];
  for (const card of cards) {
    if (result.length >= limit) break;
    const position = await db.positions.get(card.position_id);
    if (position && position.deleted === 0) result.push({ card, position });
  }
  return result;
}

/** Cuántas tarjetas están vencidas ahora. */
export async function countDue(): Promise<number> {
  const ts = now();
  return db.srs_cards
    .where("due")
    .belowOrEqual(ts)
    .filter((c) => c.deleted === 0)
    .count();
}
