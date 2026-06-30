import Dexie, { type EntityTable } from "dexie";
import type {
  AppSettings,
  Category,
  Collection,
  Deck,
  Game,
  GameTag,
  Position,
  PositionTag,
  Review,
  SrsCard,
  Tag,
  Variation,
} from "./schema.ts";

// Subclase tipada de Dexie. Los índices reflejan los del DDL (FASE-0 §3):
//   idx_cards_due, idx_pos_game, idx_games_coll (+ los necesarios para queries de Fase 1).
// Solo se declaran como índice las columnas por las que filtramos/ordenamos; el resto
// de campos viaja en el objeto sin indexar.
class ChessTrainerDB extends Dexie {
  collections!: EntityTable<Collection, "id">;
  games!: EntityTable<Game, "id">;
  positions!: EntityTable<Position, "id">;
  tags!: EntityTable<Tag, "id">;
  position_tags!: EntityTable<PositionTag, "position_id">;
  game_tags!: EntityTable<GameTag, "game_id">;
  decks!: EntityTable<Deck, "id">;
  srs_cards!: EntityTable<SrsCard, "id">;
  reviews!: EntityTable<Review, "id">;
  variations!: EntityTable<Variation, "id">;
  settings!: EntityTable<AppSettings, "id">;
  categories!: EntityTable<Category, "id">;

  constructor() {
    super("chess-trainer");
    this.version(1).stores({
      collections: "id, type, deleted, updated_at",
      games: "id, collection_id, deleted, updated_at",
      positions: "id, game_id, deleted, updated_at",
      tags: "id, &name, category",
      // claves compuestas para las tablas puente
      position_tags: "[position_id+tag_id], position_id, tag_id",
      game_tags: "[game_id+tag_id], game_id, tag_id",
      decks: "id, deleted, updated_at",
      srs_cards: "id, due, deck_id, position_id, state, deleted, updated_at",
      reviews: "id, card_id, reviewed_at",
    });
    // v2 — Fase Variantes: SOLO agrega el store `variations`. Dexie conserva todos los
    // stores de v1 sin tocarlos (migración aditiva: no se pierden torneos/tarjetas/tags).
    this.version(2).stores({
      variations: "id, position_id, deleted, updated_at",
    });
    // v3 — Fase Jerarquía: tags anidados. SOLO añade el índice `parent_id` al store
    // `tags` (migración aditiva: NO recrea stores, NO pierde datos). El upgrade rellena
    // parent_id = null en los tags existentes → todos quedan como raíz.
    // Nota: IndexedDB no indexa null/undefined, así que las raíces se calculan en memoria
    // (parent_id == null); el índice `parent_id` se usa solo para buscar hijos de un nodo.
    this.version(3)
      .stores({
        tags: "id, &name, category, parent_id",
      })
      .upgrade(async (tx) => {
        await tx
          .table("tags")
          .toCollection()
          .modify((tag: { parent_id?: string | null }) => {
            if (tag.parent_id === undefined) tag.parent_id = null;
          });
      });
    // v4 — Fase Estudiar: SOLO agrega el store `settings` (registro singleton para el
    // cupo de nuevas/día). Migración aditiva: no recrea stores, no pierde datos.
    this.version(4).stores({
      settings: "id",
    });
    // v5 — Fase Final: categorías editables. SOLO agrega el store `categories`. Migración
    // aditiva (no recrea stores, no pierde datos). Las 5 de fábrica se siembran de forma
    // idempotente al arranque (ensureDefaultCategories), no en el upgrade, para cubrir
    // también instalaciones nuevas. `Tag.category` sigue guardando el `key` (slug).
    this.version(5).stores({
      categories: "id, key, deleted, sort_order",
    });
  }
}

export const db = new ChessTrainerDB();
