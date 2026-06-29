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

/**
 * Intercalado deliberado: agrupa por primer tag (las sin tag forman su grupo) y hace
 * round-robin entre grupos, preservando el orden de entrada dentro de cada uno.
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

/** Todas las tarjetas vencidas (due <= ahora) vivas, con su posición y tags, orden por due. */
async function loadDueBase(): Promise<StudyCard[]> {
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
  return base;
}

/**
 * Cola del repaso del día (Fase Estudiar §2/§3): los repasos vencidos **no-nuevos siempre
 * completos** + las tarjetas **nuevas acotadas a `newLimit`**, todo intercalado por tema.
 * Mueve el calendario (se califica con FSRS). El límite controla SOLO las nuevas.
 */
export async function getDayReviewQueue(opts: {
  newLimit: number;
}): Promise<StudyCard[]> {
  const base = await loadDueBase();
  const reviews = base.filter((b) => b.card.state !== "new");
  const news = base
    .filter((b) => b.card.state === "new")
    .slice(0, Math.max(0, opts.newLimit));
  return interleaveByTag([...reviews, ...news]);
}

/** Cuántas tarjetas nuevas (state `new`) hay vencidas ahora (para acotar el prompt). */
export async function countDueNew(): Promise<number> {
  const ts = now();
  return db.srs_cards
    .where("due")
    .belowOrEqual(ts)
    .filter((c) => c.deleted === 0 && c.state === "new")
    .count();
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
