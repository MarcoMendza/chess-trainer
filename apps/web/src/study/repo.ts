import { db } from "../db/db.ts";
import { newRow, now } from "../db/helpers.ts";
import { tagIdsByPosition } from "../tags/repo.ts";
import type {
  CardType,
  Color,
  Deck,
  Position,
  SrsCard,
  Variation,
  VariationNode,
} from "../db/schema.ts";
import { hasMoves } from "./variations.ts";

export interface StudyCard {
  card: SrsCard;
  position: Position;
  tagIds: string[];
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
  sourceUrl?: string; // link del video (Chess Enigma, etc.)
  sourceTime?: string; // mm:ss para re-ver el momento
  tagIds?: string[]; // temas (M:N vía position_tags)
  tree?: VariationNode; // árbol de variantes opcional (Fase Variantes)
}

/**
 * Crea una `position` y su `srs_card` asociada (estado `new`, vencida ahora para que
 * aparezca en el primer repaso). Si vienen `tagIds`, escribe también las filas
 * `position_tags` en la misma transacción. Devuelve la tarjeta creada.
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
    source_url: input.sourceUrl,
    source_time: input.sourceTime,
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
  const tagIds = input.tagIds ?? [];
  const tree = hasMoves(input.tree) ? input.tree! : null;
  await db.transaction(
    "rw",
    db.positions,
    db.srs_cards,
    db.position_tags,
    db.variations,
    async () => {
      await db.positions.add(position);
      await db.srs_cards.add(card);
      if (tagIds.length) {
        await db.position_tags.bulkAdd(
          tagIds.map((tag_id) => ({ position_id: position.id, tag_id })),
        );
      }
      if (tree) {
        const variation: Variation = {
          ...newRow(),
          position_id: position.id,
          tree,
        };
        await db.variations.add(variation);
      }
    },
  );
  return card;
}

/**
 * Guarda una posición como tarjeta de estudio en el mazo "Posiciones sueltas".
 * Acepta el input completo (idea, eval_note, link de video, minuto, tags).
 */
export type SaveCardInput = Omit<NewCardInput, "deckId" | "cardType">;

export async function saveCard(input: SaveCardInput): Promise<SrsCard> {
  const deck = await getOrCreateDeck(
    "Posiciones sueltas",
    "FENs cargados a mano para estudiar.",
  );
  return createPositionWithCard({ ...input, deckId: deck.id });
}

// ===== Consultas de repaso =====

export interface StudyOptions {
  /** Acotar a un tema (modo bloque). Si se omite, entran todas las vencidas. */
  tagId?: string;
  /** Mezclar temas a propósito (default en "todas"). Ignorado si hay tagId. */
  interleave?: boolean;
  limit?: number;
}

/**
 * Intercalado deliberado: agrupa por primer tag (las sin tag forman su grupo) y hace
 * round-robin entre grupos, preservando el orden por `due` dentro de cada uno.
 */
function interleaveByTag(items: StudyCard[]): StudyCard[] {
  const groups = new Map<string, StudyCard[]>();
  for (const it of items) {
    const key = it.tagIds[0] ?? "__none__";
    const g = groups.get(key);
    if (g) g.push(it);
    else groups.set(key, [it]);
  }
  const lists = [...groups.values()];
  const out: StudyCard[] = [];
  for (let i = 0; out.length < items.length; i++) {
    for (const list of lists) if (i < list.length) out.push(list[i]);
  }
  return out;
}

/**
 * Tarjetas vencidas (due <= ahora) no borradas, con su posición y tags.
 * Default (sin tagId): orden intercalado por tema. Con tagId: solo ese tema, en orden de due.
 */
export async function getDueStudyCards(
  opts: StudyOptions = {},
): Promise<StudyCard[]> {
  const { tagId, interleave = true, limit = 50 } = opts;
  const ts = now();
  const cards = await db.srs_cards
    .where("due")
    .belowOrEqual(ts)
    .filter((c) => c.deleted === 0)
    .sortBy("due");

  const base: StudyCard[] = [];
  for (const card of cards) {
    const position = await db.positions.get(card.position_id);
    if (position && position.deleted === 0) {
      base.push({ card, position, tagIds: [] });
    }
  }
  const tagMap = await tagIdsByPosition(base.map((b) => b.position.id));
  for (const item of base) item.tagIds = tagMap.get(item.position.id) ?? [];

  if (tagId) {
    return base.filter((b) => b.tagIds.includes(tagId)).slice(0, limit);
  }
  const ordered = interleave ? interleaveByTag(base) : base;
  return ordered.slice(0, limit);
}

/** Conteo de tarjetas vencidas por tag (para el selector de modo en Estudiar). */
export async function getDueTagCounts(): Promise<Map<string, number>> {
  const due = await getDueStudyCards({ interleave: false, limit: Infinity });
  const counts = new Map<string, number>();
  for (const c of due) {
    for (const t of c.tagIds) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
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
