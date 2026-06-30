# Fase Final — cierre v1.1.0

Tres ajustes para cerrar la v1.1.0. Rama `fase-final` desde `main` (con la Fase Anotar ya
mergeada). Sin cambios destructivos de esquema; el motor on-device se reusa (no se toca).

---

## 1. Editar partidas y tarjetas

Poder abrir lo guardado y modificarlo (jugadas, variantes, notas, datos) re-usando el editor
de variantes compartido (`VariationEditor` + `useVariationTree`).

- `useVariationTree(rootFen, initialTree?)`: con árbol inicial se siembra desde él (editar);
  sin él, raíz nueva (comportamiento previo intacto).
- **Partidas** (`GameViewPage`): botón "Editar" → modo edición con el editor sembrado desde
  `pgnToTree(game.pgn)`. "Promover a principal" + "Guardar cambios" re-serializan a PGN
  (`treeToPgn`) **preservando sidelines y comentarios** (round-trip por las mismas funciones
  puras con tests). `SaveGameSheet` acepta `game` y **actualiza** (`updateGame`) en vez de crear.
  Salvedad: el color de nodo (main/sub/bad/conditional) es metadato solo-editor y no existe en
  PGN, así que no persiste en partidas (igual que antes).
- **Tarjetas**: `SaveCardSheet` gana modo edición (prefill idea/eval/url/min/tags + árbol).
  Botón "Editar" en `StudyCard` (repaso y práctica). Al guardar se recarga la ficha en sitio
  (nonce en `useCardTree` + `getPosition`). Nuevo `updateCardPosition`; al vaciar el árbol se
  borra con `clearVariationByPosition`. No reprograma FSRS.

## 2. Motor al revisar partida

Motor on-device embebido en `GameViewPage` igual que en Anotar (sin navegar a `/analizar`).

- Se extrae el panel del motor (antes inline en `NewGamePage`) a piezas reutilizables:
  `analysis/EnginePanel.tsx` (líneas MultiPV + selector + "Detener") y
  `analysis/useEmbeddedEngine.ts` (toggle, relanzar al cambiar FEN, flecha + mejor línea).
  `NewGamePage` también las usa ahora. **No se toca `useEngine`/`engine.ts`/worker.**
- En `GameViewPage` (vista de árbol y fallback lineal): el botón "Analizar con motor" monta el
  panel embebido sobre la posición actual, con barra de eval y flecha de mejor jugada.

## 3. Categorías editables (constante → datos)

Las 5 categorías (Finales/Estructura/Táctica/Apertura/Medio juego) dejan de estar hardcodeadas
y pasan a un store; se pueden añadir/renombrar/recolorear/borrar desde "Gestionar temas".

- **Clave de la migración (no rompe nada)**: `tags.category` **sigue guardando el `key` (slug)**.
  No se migra ningún tag. Solo se dejan de hardcodear lista/labels/colores y se leen del store,
  **sembrando las 5 de fábrica con sus mismos slugs/labels/colores**.
- Nuevo store `categories` (Dexie **v5**, aditivo). `TagCategory` pasa de unión literal a `string`.
- `tags/categories.ts`: paleta fija de colores (clases Tailwind literales → no rompe el purge),
  CRUD (`listCategories/createCategory/updateCategory/deleteCategory`), semilla idempotente
  (`ensureDefaultCategories`, al arranque, cubre instalaciones nuevas y existentes) y hook
  `useCategories()` (`{ categories, byKey, label(key), chip(key) }`).
- Consumidores adaptados al hook: `TagPicker`, `TagsAdminPage`, `PracticePanel`, `TrainPage`,
  `StudyCard`, `CollectionDetailPage`. `tags/repo.ts` sin cambios de lógica (opera con el key).
- Borrar una categoría deja sus tags "Sin categoría" (no borra tags ni posiciones).

## Listo cuando
- [ ] `pnpm --filter web build` limpio; datos intactos; migración aditiva (v5).
- [ ] Abres una partida/tarjeta guardada, la editas y re-guardas; el PGN conserva variantes/notas.
- [ ] El motor evalúa embebido en GameViewPage (eval/mejor jugada/MultiPV + Detener).
- [ ] Puedes crear/renombrar/recolorear/borrar categorías; el selector de padre, la práctica por
      categoría, Entrenar y los colores siguen funcionando.

## Decisiones cerradas
1. Editar tarjeta: entrada por botón en `StudyCard` (repaso y práctica).
2. Motor: se extrae a `EnginePanel` + `useEmbeddedEngine` y se reusa en Anotar y ver partida.
3. Categorías como datos con `tags.category` = slug estable (cero migración de tags); borrar deja
   los tags "Sin categoría".
