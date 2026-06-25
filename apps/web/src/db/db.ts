import Dexie, { type EntityTable } from "dexie";
import type {
  Collection,
  Deck,
  Game,
  GameTag,
  Position,
  PositionTag,
  Review,
  SrsCard,
  Tag,
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
  }
}

export const db = new ChessTrainerDB();
