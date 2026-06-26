# Fase Variantes — árbol de variantes con notas y colores

Editor y reproducción de variantes dentro de una tarjeta, con árbol visual estilo Lichess/ChessBase.
Para estudiar aperturas y finales con precisión: la idea suelta no basta, importa la secuencia.

> Parte de la rama `vercel-deploy` (lo último bueno). NO de `main` (está viejo).
> Primer paso del agente: confirmar que `pnpm --filter web build` pasa limpio ANTES de tocar nada.

---

## 1. Objetivo

Que una tarjeta pueda llevar un árbol de variantes (línea principal + ramas), cada jugada con
color y nota, y que al estudiar puedas reproducir la línea con feedback de color. Reusa el tablero
de análisis ya existente (Chessground + chess.js + autoShapes).

## 2. Colores (semántica fija)

- 🟢 verde  = línea principal (lo que hay que jugar)
- 🟡 amarillo = subvariante válida, no principal
- 🔴 rojo    = línea mala / jugada fuera del árbol (el error típico)
- 🔵 azul    = continuación condicional ("si NO juega a6, entonces a4 y…")

## 3. Alcance v1 (todo: editor + reproducción + notas + handoff a motor)

### 3.1 Editor de variantes (al sembrar la tarjeta)
- Botón "Agregar variante" en SaveCardSheet → abre tablero interactivo desde el FEN de la tarjeta.
- Construyes la línea principal moviendo piezas; desde cualquier nodo, una jugada alternativa crea
  una **rama** (nodo hermano).
- Por nodo: asignar **color** (principal/sub/mala/condicional) y escribir una **nota**.
- Panel de árbol en vivo, estilo Lichess/ChessBase (ver §5, requisito visual).
- Guardar la tarjeta **con o sin** árbol (el árbol es opcional).

### 3.2 Reproducción (al estudiar/entrenar la tarjeta)
- Sale la posición; ejecutas las jugadas de memoria, SIN ver el árbol.
- Feedback por color según el árbol guardado (verde/amarillo/azul/rojo).
- **Toggle de modo** (por sesión):
  - **Colorear (default, libre):** mueves cualquier jugada legal; se pinta según el árbol; nunca te frena.
  - **Estricto (drill):** solo deja jugar la principal; otra jugada regresa la pieza y no avanza.
- Al llegar a un nodo con nota, se muestra la nota.

### 3.3 Botones al estudiar
- **"Ver árbol"** → revela el árbol completo con flechas/anotaciones (la respuesta).
- **"Analizar con motor"** → captura el FEN actual y abre la sección de Análisis con esa posición.
  NOTA: el motor está roto en el deploy (Vercel); se arregla en tarea aparte. El handoff se construye
  igual; la evaluación funcionará cuando se repare el motor. Esta fase NO arregla el motor.

## 4. Modelo de datos (amplía Fase 0 — aprobado)

Tabla nueva `variations` (una por posición, el árbol como JSON):

```sql
CREATE TABLE variations (
  id          TEXT PRIMARY KEY,            -- UUID v4
  position_id TEXT NOT NULL REFERENCES positions(id),
  tree        TEXT NOT NULL,               -- JSON del árbol (ver shape abajo)
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);
```

Shape del nodo (JSON):
```json
{
  "move": "Bd3",            // SAN; null en la raíz
  "fen": "….",              // FEN tras la jugada
  "color": "main",          // main | sub | bad | conditional | null
  "note": "texto o null",
  "children": [ /* nodos */ ]
}
```
La raíz representa el FEN de la tarjeta; sus `children` son las jugadas candidatas.

CUIDADO CON LA MIGRACIÓN (hay datos reales en el cel):
- Bumpear la versión de Dexie de forma **aditiva**: solo agregar el store `variations`,
  conservando TODOS los stores existentes. NO recrear ni borrar stores → no perder torneos/tarjetas/tags.
- Reflejar la tabla nueva en `docs/FASE-0-DISENO.md` (el CLAUDE.md exige no cambiar el esquema sin documentarlo).

## 5. Requisito visual (central, no opcional)

El árbol debe **verse y entenderse como Lichess/ChessBase**:
- Línea principal en línea; subvariantes indentadas/entre paréntesis y anidadas.
- Tokens de jugada coloreados según §2.
- Notas visibles junto a su jugada (no escondidas).
- Navegable: tocar una jugada salta a esa posición en el tablero.
- Legible en móvil (S26): no apretado, scrolleable.

## 6. Caso de aceptación (el Colle de Marco)

> Tarjeta FEN: tras 1.d4 d5 2.Nf3 Nf6 3.e3 e6 4.Bd3 c5
> Idea: "Variante Zukertort"
> Evaluación: "Caballo a e5, romper con b3, fianchetto…"
> Árbol: 5.O-O c4 6.Be2 b5 7.b3 a6 (principal/verde),
>        con nota azul en a6: "si negras no juegan a6, a4 debilita su estructura"

Debe poder: sembrarse con ese árbol, estudiarse reproduciendo la línea con colores,
ver el árbol, y mandar la posición al análisis.

## 7. Listo cuando
- [ ] `pnpm --filter web build` pasa limpio antes y después.
- [ ] Siembras una tarjeta con árbol (línea principal + una rama + colores + notas).
- [ ] Al estudiar, reproduces la línea con feedback de color; el toggle estricto bloquea lo no-principal.
- [ ] "Ver árbol" muestra el árbol estilo Lichess; "Analizar con motor" abre Análisis con el FEN.
- [ ] El árbol se ve bien y se entiende en el S26.
- [ ] Los datos existentes en IndexedDB siguen intactos tras la migración.

## 8. Decisiones cerradas
1. Modo: **colorear default + toggle a estricto**.
2. Almacenamiento: **árbol como JSON** en tabla `variations` (export a PGN para ChessBase, después).
3. Alcance: **árbol completo** (editor + reproducción + notas + handoff a motor) en esta fase.
4. Motor: se arregla **aparte**; esta fase solo construye el handoff.
