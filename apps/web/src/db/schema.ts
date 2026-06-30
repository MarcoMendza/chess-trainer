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

// Categoría de un tag: el `key` (slug) de una fila `Category`. String para permitir
// categorías definidas por el usuario (ver `categories` store + tags/categories.ts).
export type TagCategory = string;

/**
 * Categoría de primer nivel, ahora editable desde la UI (antes hardcodeada).
 * `key` es el slug estable que se guarda en `Tag.category` (FK lógica); `label` y `color`
 * son presentación editables. Se siembran las 5 de fábrica (finales/estructura/…).
 */
export interface Category extends SyncBase {
  key: string;
  label: string;
  color: string; // token de paleta (ver tags/categories.ts PALETTE)
  sort_order: number;
}

export interface Tag {
  id: string;
  name: string; // único
  category?: TagCategory;
  parent_id?: string | null; // null/undefined = raíz (cuelga de su categoría)
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

/**
 * Color de un nodo del árbol de variantes (semántica fija, ver docs/FASE-VARIANTES §2):
 * main = línea principal (verde), sub = subvariante válida (amarillo),
 * bad = error documentado (rojo), conditional = continuación condicional (azul).
 * `null` = nodo sin color asignado. El rojo automático "fuera de árbol" no se almacena:
 * se deriva al reproducir (una jugada que no matchea ningún hijo se pinta roja).
 */
export type NodeColor = "main" | "sub" | "bad" | "conditional";

/**
 * Nodo del árbol de variantes. La raíz representa el FEN de la tarjeta (move/color/note
 * en null) y sus `children` son las jugadas candidatas. Cada nodo hijo guarda el SAN de
 * la jugada y el FEN resultante (para navegar/pintar sin recomputar toda la línea).
 */
export interface VariationNode {
  move: string | null; // SAN; null solo en la raíz
  fen: string; // FEN tras la jugada (en la raíz, el FEN de la tarjeta)
  color: NodeColor | null;
  note: string | null;
  children: VariationNode[];
}

/** Árbol de variantes de una posición (una `Variation` por `position_id`). */
export interface Variation extends SyncBase {
  position_id: string;
  tree: VariationNode; // árbol completo (Dexie lo serializa como objeto)
}

/**
 * Settings de la app (registro singleton, `id = "app"`). Key-value simple para
 * preferencias locales del dispositivo. Hoy solo guarda el cupo de tarjetas nuevas
 * por día de Estudiar (ver docs/FASE-ESTUDIAR.md §3). Aditivo: no sincroniza.
 */
export interface AppSettings {
  id: "app";
  newPerDayDefault: number; // preset recordado para el prompt "¿cuántas nuevas hoy?"
  studyDay: string; // "YYYY-MM-DD" local al que pertenecen los contadores de abajo
  newGoalToday: number; // nuevas elegidas para `studyDay`
  newDoneToday: number; // nuevas ya introducidas (calificadas) en `studyDay`
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
