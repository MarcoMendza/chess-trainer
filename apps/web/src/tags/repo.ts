import { db } from "../db/db.ts";
import { newId } from "../db/helpers.ts";
import type { Position, Tag, TagCategory } from "../db/schema.ts";

// Capa de tags: CRUD + relaciones M:N (position_tags / game_tags).
// Tag NO es SyncBase (no tiene soft-delete), así que borrar es físico + cascada.

// ===== Jerarquía (Fase Jerarquía): árbol padre/hijo, un solo padre por tag =====

/** Tope de anidación: raíz (nivel 1) › … › nivel 4. */
export const MAX_TAG_DEPTH = 4;

/** ¿Es raíz? (parent_id null/undefined = cuelga directo de su categoría). */
export function isRoot(tag: Tag): boolean {
  return tag.parent_id == null;
}

/** Mapa parentId → hijos (orden alfabético). La clave "" agrupa las raíces. */
function childrenMap(tags: Tag[]): Map<string, Tag[]> {
  const map = new Map<string, Tag[]>();
  for (const t of tags) {
    const key = t.parent_id ?? "";
    const list = map.get(key);
    if (list) list.push(t);
    else map.set(key, [t]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
  return map;
}

/** Hijos directos de un nodo, en orden alfabético. */
export function childrenOf(tags: Tag[], parentId: string | null): Tag[] {
  return childrenMap(tags).get(parentId ?? "") ?? [];
}

/** Tags raíz (sin padre), en orden alfabético. */
export function rootTags(tags: Tag[]): Tag[] {
  return childrenOf(tags, null);
}

/** El nodo + todos sus descendientes (IDs). Usado para juntar el subárbol. */
export function descendantIds(tags: Tag[], tagId: string): string[] {
  const kids = childrenMap(tags);
  const out: string[] = [];
  const stack = [tagId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const c of kids.get(id) ?? []) stack.push(c.id);
  }
  return out;
}

/** Cadena de ancestros (de padre a raíz), sin incluir el propio nodo. */
export function ancestorIds(tags: Tag[], tagId: string): string[] {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const out: string[] = [];
  const guard = new Set<string>(); // defensa anti-bucle por datos corruptos
  let cur = byId.get(tagId)?.parent_id ?? null;
  while (cur && !guard.has(cur)) {
    guard.add(cur);
    out.push(cur);
    cur = byId.get(cur)?.parent_id ?? null;
  }
  return out;
}

/** Profundidad del nodo: raíz = 1. */
export function tagDepth(tags: Tag[], tagId: string): number {
  return ancestorIds(tags, tagId).length + 1;
}

/** Altura del subárbol bajo el nodo: hoja = 1. */
export function subtreeHeight(tags: Tag[], tagId: string): number {
  const kids = childrenMap(tags);
  const h = (id: string): number => {
    const cs = kids.get(id) ?? [];
    return cs.length ? 1 + Math.max(...cs.map((c) => h(c.id))) : 1;
  };
  return h(tagId);
}

/**
 * Padres válidos para `tagId`: excluye sí-mismo y sus descendientes (no ciclos) y
 * los que harían superar el tope (profundidad del padre + altura del subárbol ≤ 4).
 */
export function validParentIds(tags: Tag[], tagId: string): string[] {
  const banned = new Set(descendantIds(tags, tagId)); // sí-mismo + descendientes
  const height = subtreeHeight(tags, tagId);
  return tags
    .filter((t) => !banned.has(t.id))
    .filter((t) => tagDepth(tags, t.id) + height <= MAX_TAG_DEPTH)
    .map((t) => t.id);
}

/** Padres válidos para un tag NUEVO (altura 1): cualquier nodo de profundidad ≤ 3. */
export function validParentIdsForNew(tags: Tag[]): string[] {
  return tags
    .filter((t) => tagDepth(tags, t.id) + 1 <= MAX_TAG_DEPTH)
    .map((t) => t.id);
}

/**
 * Conteo por subárbol: para cada nodo, ítems distintos cuyos tags caen en su subárbol.
 * Cada ítem cuenta una sola vez por nodo aunque tenga varios tags del mismo subárbol.
 */
export function subtreeCounts(
  tags: Tag[],
  items: Array<{ tagIds: string[] }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const covering = new Set<string>();
    for (const tagId of item.tagIds) {
      covering.add(tagId);
      for (const anc of ancestorIds(tags, tagId)) covering.add(anc);
    }
    for (const node of covering) counts.set(node, (counts.get(node) ?? 0) + 1);
  }
  return counts;
}

// ===== CRUD de tags =====

export async function listTags(): Promise<Tag[]> {
  const tags = await db.tags.toArray();
  return tags.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Crea el tag o devuelve el existente (dedupe case-insensitive sobre el nombre).
 * Si se pasa `parentId`, el nuevo tag cuelga de él y hereda su categoría
 * (la raíz de cada árbol define la categoría del subárbol).
 */
export async function getOrCreateTag(
  name: string,
  category?: TagCategory,
  parentId?: string | null,
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
  const parent_id = parentId ?? null;
  let cat = category;
  if (parent_id) {
    const parent = await db.tags.get(parent_id);
    if (parent?.category) cat = parent.category; // heredar categoría del padre
  }
  const tag: Tag = { id: newId(), name: clean, category: cat, parent_id };
  await db.tags.add(tag);
  return tag;
}

export async function updateTag(
  id: string,
  changes: { name?: string; category?: TagCategory },
): Promise<void> {
  await db.transaction("rw", db.tags, async () => {
    if (changes.name !== undefined) {
      await db.tags.update(id, { name: changes.name.trim() });
    }
    if (changes.category !== undefined) {
      // La categoría es del árbol: propagar a todo el subárbol (raíz→hojas).
      const tags = await db.tags.toArray();
      const ids = descendantIds(tags, id);
      await db.tags.where("id").anyOf(ids).modify({ category: changes.category });
    }
  });
}

/**
 * Reasigna el padre de un tag (o lo vuelve raíz con `parentId = null`).
 * Valida sin ciclos y sin superar el tope. Al recibir padre, hereda su categoría
 * y la propaga al subárbol; al volverse raíz conserva su categoría actual.
 */
export async function setTagParent(
  tagId: string,
  parentId: string | null,
): Promise<void> {
  const tags = await db.tags.toArray();
  const tag = tags.find((t) => t.id === tagId);
  if (!tag) return;
  if (parentId) {
    if (!validParentIds(tags, tagId).includes(parentId)) {
      throw new Error("Padre inválido: crearía un ciclo o superaría 4 niveles.");
    }
  }
  const parent = parentId ? tags.find((t) => t.id === parentId) : null;
  await db.transaction("rw", db.tags, async () => {
    await db.tags.update(tagId, { parent_id: parentId });
    if (parent?.category && parent.category !== tag.category) {
      const ids = descendantIds(tags, tagId);
      await db.tags.where("id").anyOf(ids).modify({ category: parent.category });
    }
  });
}

export type DeleteTagStrategy = "promote" | "cascade";

/**
 * Borra un tag y sus relaciones (position_tags / game_tags).
 * - `promote` (default): los hijos directos suben al padre del nodo borrado (su abuelo);
 *   si el nodo era raíz, los hijos quedan como raíz.
 * - `cascade`: borra también todo el subárbol y sus relaciones.
 */
export async function deleteTag(
  id: string,
  strategy: DeleteTagStrategy = "promote",
): Promise<void> {
  const tags = await db.tags.toArray();
  const target = tags.find((t) => t.id === id);
  if (!target) return;

  if (strategy === "cascade") {
    const ids = descendantIds(tags, id); // nodo + descendientes
    await db.transaction("rw", db.tags, db.position_tags, db.game_tags, async () => {
      await db.position_tags.where("tag_id").anyOf(ids).delete();
      await db.game_tags.where("tag_id").anyOf(ids).delete();
      await db.tags.where("id").anyOf(ids).delete();
    });
    return;
  }

  const directChildren = tags.filter((t) => t.parent_id === id);
  await db.transaction("rw", db.tags, db.position_tags, db.game_tags, async () => {
    for (const child of directChildren) {
      await db.tags.update(child.id, { parent_id: target.parent_id ?? null });
    }
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
 * Conteo de posiciones (no borradas) por nodo, contando todo su subárbol.
 * Respeta M:N y deduplica: una posición con varios tags del mismo subárbol cuenta una vez
 * por nodo. Devuelve solo nodos con conteo > 0.
 */
export async function countPositionsBySubtree(): Promise<Map<string, number>> {
  const [tags, rows] = await Promise.all([
    db.tags.toArray(),
    db.position_tags.toArray(),
  ]);
  // position_id → tagIds, solo posiciones vivas (cache para no consultar repetido).
  const aliveCache = new Map<string, boolean>();
  const byPos = new Map<string, string[]>();
  for (const row of rows) {
    let alive = aliveCache.get(row.position_id);
    if (alive === undefined) {
      const pos = await db.positions.get(row.position_id);
      alive = !!pos && pos.deleted === 0;
      aliveCache.set(row.position_id, alive);
    }
    if (!alive) continue;
    const list = byPos.get(row.position_id);
    if (list) list.push(row.tag_id);
    else byPos.set(row.position_id, [row.tag_id]);
  }
  const items = [...byPos.values()].map((tagIds) => ({ tagIds }));
  return subtreeCounts(tags, items);
}

/** El tag + todos sus descendientes (IDs), leyendo el árbol de la base. */
export async function descendantTagIds(tagId: string): Promise<string[]> {
  const tags = await db.tags.toArray();
  return descendantIds(tags, tagId);
}

/** Posiciones (no borradas) del subárbol del nodo (el nodo y sus descendientes). */
export async function positionsBySubtree(tagId: string): Promise<Position[]> {
  const ids = await descendantTagIds(tagId);
  const rows = await db.position_tags.where("tag_id").anyOf(ids).toArray();
  const posIds = [...new Set(rows.map((r) => r.position_id))];
  const positions = await db.positions.bulkGet(posIds);
  return positions
    .filter((p): p is Position => !!p && p.deleted === 0)
    .sort((a, b) => a.created_at - b.created_at);
}

/**
 * Posiciones (no borradas) de una categoría de primer nivel (Práctica, Fase Estudiar §4):
 * todas las fichas etiquetadas con cualquier tag de esa categoría (raíces y subárbol, que
 * heredan la categoría). Independiente del calendario FSRS: no mira `due`.
 */
export async function positionsByCategory(
  category: TagCategory,
): Promise<Position[]> {
  const tags = await db.tags.toArray();
  const ids = tags.filter((t) => t.category === category).map((t) => t.id);
  if (!ids.length) return [];
  const rows = await db.position_tags.where("tag_id").anyOf(ids).toArray();
  const posIds = [...new Set(rows.map((r) => r.position_id))];
  const positions = await db.positions.bulkGet(posIds);
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
