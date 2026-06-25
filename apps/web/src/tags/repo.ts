import { db } from "../db/db.ts";
import { newId } from "../db/helpers.ts";
import type { Position, Tag, TagCategory } from "../db/schema.ts";

// Capa de tags: CRUD + relaciones M:N (position_tags / game_tags).
// Tag NO es SyncBase (no tiene soft-delete), así que borrar es físico + cascada.

// ===== CRUD de tags =====

export async function listTags(): Promise<Tag[]> {
  const tags = await db.tags.toArray();
  return tags.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Crea el tag o devuelve el existente (dedupe case-insensitive sobre el nombre). */
export async function getOrCreateTag(
  name: string,
  category?: TagCategory,
): Promise<Tag> {
  const clean = name.trim();
  const lower = clean.toLowerCase();
  const existing = (await db.tags.toArray()).find(
    (t) => t.name.toLowerCase() === lower,
  );
  if (existing) {
    // Si llega categoría y el tag no tenía, la completamos.
    if (category && !existing.category) {
      await db.tags.update(existing.id, { category });
      return { ...existing, category };
    }
    return existing;
  }
  const tag: Tag = { id: newId(), name: clean, category };
  await db.tags.add(tag);
  return tag;
}

export async function updateTag(
  id: string,
  changes: { name?: string; category?: TagCategory },
): Promise<void> {
  const patch: { name?: string; category?: TagCategory } = {};
  if (changes.name !== undefined) patch.name = changes.name.trim();
  if (changes.category !== undefined) patch.category = changes.category;
  await db.tags.update(id, patch);
}

/** Borra el tag y todas sus relaciones (position_tags / game_tags). */
export async function deleteTag(id: string): Promise<void> {
  await db.transaction("rw", db.tags, db.position_tags, db.game_tags, async () => {
    await db.position_tags.where("tag_id").equals(id).delete();
    await db.game_tags.where("tag_id").equals(id).delete();
    await db.tags.delete(id);
  });
}

// ===== Relaciones M:N =====

/** Reemplaza el conjunto de tags de una posición por `tagIds`. */
export async function setPositionTags(
  positionId: string,
  tagIds: string[],
): Promise<void> {
  await db.transaction("rw", db.position_tags, async () => {
    await db.position_tags.where("position_id").equals(positionId).delete();
    if (tagIds.length) {
      await db.position_tags.bulkAdd(
        tagIds.map((tag_id) => ({ position_id: positionId, tag_id })),
      );
    }
  });
}

/** Reemplaza el conjunto de tags de una partida por `tagIds`. */
export async function setGameTags(gameId: string, tagIds: string[]): Promise<void> {
  await db.transaction("rw", db.game_tags, async () => {
    await db.game_tags.where("game_id").equals(gameId).delete();
    if (tagIds.length) {
      await db.game_tags.bulkAdd(
        tagIds.map((tag_id) => ({ game_id: gameId, tag_id })),
      );
    }
  });
}

async function tagsByIds(ids: string[]): Promise<Tag[]> {
  if (!ids.length) return [];
  const tags = await db.tags.bulkGet(ids);
  return tags.filter((t): t is Tag => !!t);
}

export async function tagsForPosition(positionId: string): Promise<Tag[]> {
  const rows = await db.position_tags
    .where("position_id")
    .equals(positionId)
    .toArray();
  return tagsByIds(rows.map((r) => r.tag_id));
}

export async function tagsForGame(gameId: string): Promise<Tag[]> {
  const rows = await db.game_tags.where("game_id").equals(gameId).toArray();
  return tagsByIds(rows.map((r) => r.tag_id));
}

// ===== Consultas por tag =====

/**
 * Conteo de posiciones (no borradas) por tag. Respeta M:N: una posición con varios
 * tags suma en cada uno. Devuelve solo tags con conteo > 0.
 */
export async function countPositionsByTag(): Promise<Map<string, number>> {
  const rows = await db.position_tags.toArray();
  const counts = new Map<string, number>();
  // Cache de posiciones vivas para no consultar repetido.
  const aliveCache = new Map<string, boolean>();
  for (const row of rows) {
    let alive = aliveCache.get(row.position_id);
    if (alive === undefined) {
      const pos = await db.positions.get(row.position_id);
      alive = !!pos && pos.deleted === 0;
      aliveCache.set(row.position_id, alive);
    }
    if (alive) counts.set(row.tag_id, (counts.get(row.tag_id) ?? 0) + 1);
  }
  return counts;
}

/** Posiciones (no borradas) que tienen el tag dado. */
export async function positionsByTag(tagId: string): Promise<Position[]> {
  const rows = await db.position_tags.where("tag_id").equals(tagId).toArray();
  const positions = await db.positions.bulkGet(rows.map((r) => r.position_id));
  return positions
    .filter((p): p is Position => !!p && p.deleted === 0)
    .sort((a, b) => a.created_at - b.created_at);
}

/** IDs de partidas etiquetadas con el tag dado (para el filtro de Torneos). */
export async function gameIdsByTag(tagId: string): Promise<Set<string>> {
  const rows = await db.game_tags.where("tag_id").equals(tagId).toArray();
  return new Set(rows.map((r) => r.game_id));
}

/** Mapa gameId → tagIds, para filtrar/listar partidas sin N consultas. */
export async function tagIdsByGames(
  gameIds: string[],
): Promise<Map<string, string[]>> {
  const set = new Set(gameIds);
  const rows = await db.game_tags.toArray();
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!set.has(row.game_id)) continue;
    const list = map.get(row.game_id);
    if (list) list.push(row.tag_id);
    else map.set(row.game_id, [row.tag_id]);
  }
  return map;
}

/** Mapa positionId → tagIds, para anotar listas sin N consultas. */
export async function tagIdsByPosition(
  positionIds: string[],
): Promise<Map<string, string[]>> {
  const set = new Set(positionIds);
  const rows = await db.position_tags.toArray();
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!set.has(row.position_id)) continue;
    const list = map.get(row.position_id);
    if (list) list.push(row.tag_id);
    else map.set(row.position_id, [row.tag_id]);
  }
  return map;
}
