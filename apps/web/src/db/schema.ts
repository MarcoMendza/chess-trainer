// Interfaces TS fieles al DDL de docs/FASE-0-DISENO.md (§3).
// Mismo esquema lógico que tendrá SQLite en el NAS (Fase 2).
// No cambiar el modelo de datos sin actualizar ese doc.

/** Campos comunes a toda tabla sincronizable (id UUID v4, timestamps epoch ms, soft-delete). */
export interface SyncBase {
  id: string;
  created_at: number;
  updated_at: number;
  deleted: 0 | 1;
}

export type CollectionType = "tournament" | "study" | "repertoire";

export interface Collection extends SyncBase {
  name: string;
  type: CollectionType;
}

export type Color = "w" | "b";

export interface Game extends SyncBase {
  collection_id: string | null;
  pgn: string; // PGN completo = fuente de verdad
  white?: string;
  black?: string;
  result?: string; // 1-0 | 0-1 | 1/2-1/2 | *
  played_on?: string; // YYYY.MM.DD
  // Campos para torneo OTB (anotar en vivo desde el cel)
  round?: string;
  board?: string;
  time_control?: string;
  my_color?: Color;
  eco?: string;
  source?: string; // chess.com | OTB | import
}

export type CardType = "idea" | "best_move";

export interface Position extends SyncBase {
  fen: string;
  game_id: string | null; // null si viene de un FEN suelto o de un curso
  ply?: number;
  side_to_move?: Color;
  card_type: CardType;
  idea?: string; // "¿cuál es la idea?"
  eval_note?: string; // ventaja / deficiencia en palabras
  best_move?: string; // SAN, solo para card_type = best_move
  source_url?: string;
  source_time?: string; // mm:ss
}

export type TagCategory =
  | "finales"
  | "estructura"
  | "tactica"
  | "apertura"
  | "medio";

export interface Tag {
  id: string;
  name: string; // único
  category?: TagCategory;
}

export interface PositionTag {
  position_id: string;
  tag_id: string;
}

export interface GameTag {
  game_id: string;
  tag_id: string;
}

export interface Deck extends SyncBase {
  name: string;
  description?: string;
}

export type SrsState = "new" | "learning" | "review" | "relearning";

export interface SrsCard extends SyncBase {
  position_id: string;
  deck_id: string | null;
  state: SrsState;
  due?: number; // epoch ms del próximo repaso
  stability?: number; // FSRS
  difficulty?: number; // FSRS
  reps: number;
  lapses: number;
  last_review?: number;
}

/** 1 again | 2 hard | 3 good | 4 easy */
export type ReviewRating = 1 | 2 | 3 | 4;

export interface Review {
  id: string;
  card_id: string;
  rating: ReviewRating;
  reviewed_at: number;
  elapsed_ms?: number;
}
