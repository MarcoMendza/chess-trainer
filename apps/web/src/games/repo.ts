import { Chess } from "chess.js";
import { db } from "../db/db.ts";
import { newRow, touch } from "../db/helpers.ts";
import type { Collection, CollectionType, Game } from "../db/schema.ts";

// ===== Colecciones (torneos) =====

export async function listCollections(
  type?: CollectionType,
): Promise<Collection[]> {
  const all = await db.collections.where("deleted").equals(0).toArray();
  const filtered = type ? all.filter((c) => c.type === type) : all;
  return filtered.sort((a, b) => b.created_at - a.created_at);
}

export async function getCollection(id: string): Promise<Collection | undefined> {
  const c = await db.collections.get(id);
  return c && c.deleted === 0 ? c : undefined;
}

export async function createCollection(
  name: string,
  type: CollectionType = "tournament",
): Promise<Collection> {
  const collection: Collection = { ...newRow(), name: name.trim(), type };
  await db.collections.add(collection);
  return collection;
}

// ===== Partidas =====

export async function listGames(collectionId: string): Promise<Game[]> {
  const games = await db.games
    .where("collection_id")
    .equals(collectionId)
    .toArray();
  return games
    .filter((g) => g.deleted === 0)
    .sort((a, b) => b.created_at - a.created_at);
}

export async function getGame(id: string): Promise<Game | undefined> {
  const g = await db.games.get(id);
  return g && g.deleted === 0 ? g : undefined;
}

export type NewGameInput = Omit<
  Game,
  keyof import("../db/schema.ts").SyncBase
>;

export async function createGame(input: NewGameInput): Promise<Game> {
  const game: Game = { ...newRow(), ...input };
  await db.games.add(game);
  return game;
}

export async function updateGame(
  id: string,
  changes: Partial<NewGameInput>,
): Promise<void> {
  await db.games.update(id, { ...touch(), ...changes });
}

export async function softDeleteGame(id: string): Promise<void> {
  await db.games.update(id, { ...touch(), deleted: 1 });
}

// ===== PGN → headers (autocompletar el formulario) =====

export interface PgnHeaders {
  white?: string;
  black?: string;
  result?: string;
  played_on?: string;
  eco?: string;
  round?: string;
}

/** Lee los headers del PGN de forma defensiva (API de chess.js varía entre versiones). */
function readHeaders(chess: Chess): Record<string, string> {
  const anyChess = chess as unknown as {
    getHeaders?: () => Record<string, string>;
    header?: () => Record<string, string>;
  };
  if (typeof anyChess.getHeaders === "function") return anyChess.getHeaders();
  if (typeof anyChess.header === "function") return anyChess.header();
  return {};
}

/**
 * Extrae los headers estándar de un PGN ya validado.
 * Devuelve null si el PGN no parsea.
 */
export function extractPgnHeaders(pgn: string): PgnHeaders | null {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn.trim());
    const h = readHeaders(chess);
    const pick = (k: string): string | undefined => {
      const v = h[k];
      return v && v !== "?" ? v : undefined;
    };
    return {
      white: pick("White"),
      black: pick("Black"),
      result: pick("Result"),
      played_on: pick("Date"),
      eco: pick("ECO"),
      round: pick("Round"),
    };
  } catch {
    return null;
  }
}
