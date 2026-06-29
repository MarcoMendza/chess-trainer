# Fase Anotar — recrear partida en tablero

En Torneos, anotar una partida jugándola en un tablero (no solo pegando PGN), con motor,
variantes y formulario de datos al guardar. Estilo ChessBase.

> Rama `fase-anotar` desde `main`. Build limpio antes de empezar.
> Reutiliza mucho de lo ya hecho: editor de variantes, motor on-device, formulario OTB, notas.

---

## 1. Objetivo

Recrear la partida que jugaste moviendo piezas en un tablero, explorar "¿qué pasó vs qué pude jugar"
con variantes, analizar con motor, y guardar como una partida normal (PGN) dentro de su torneo.

## 2. Convive con lo existente (NO reemplaza)

- El "pegar PGN" actual en Torneos se queda igual.
- Se agrega un botón **"Nueva partida"** que abre el flujo de tablero. Dos caminos de entrada al
  mismo resultado (una partida en `games`).

## 3. Flujo

1. En un torneo (o desde Torneos), botón **"Nueva partida"** → abre tablero interactivo desde la
   posición inicial.
2. **Recreas la partida** moviendo piezas (chess.js valida, chessground arrastra). La línea que vas
   jugando es la **partida real** (línea principal).
3. **Variantes "¿qué pude jugar?"**: desde cualquier jugada, una jugada alternativa crea una rama
   (reusa el editor de variantes existente: colores, notas por nodo, borrar nodo).
   - Botón **"Promover a principal"** (estilo ChessBase): si te equivocaste de orden, mover una
     línea a principal y la anterior pasa a variante.
4. **Analizar con motor** ahí mismo (reusa stockfish.wasm: barra/eval/flecha/MultiPV). No obligatorio.
5. **Notas**: una **general** de la partida + notas **por línea/variante** (reusa el sistema de
   notas del árbol de las tarjetas).
6. Botón **Guardar** → formulario (§4) → persiste como partida (PGN).

## 4. Formulario al guardar

**Por partida** (cambian, se capturan aquí):
- Blancas, Negras, Mi color, Mesa, Ronda, Resultado, Fecha (puede ser distinta por día).

**Del torneo** (heredados, NO se re-capturan por partida):
- Ritmo (time_control) y el torneo (collection) ya seleccionado.

**Notas**: general de la partida + por línea/variante (ver §3.5).

El torneo ya viene seleccionado (entraste desde él); si se entra desde "Nueva partida" suelta,
selector de torneo como en el flujo de importar.

## 5. Almacenamiento (PGN = fuente de verdad)

- Se guarda en el store `games` existente. **El PGN es la fuente de verdad** (consistente con Fase 0).
- Las **variantes** se serializan como **sidelines dentro del PGN** (formato estándar, lo lee
  ChessBase). Las notas como comentarios PGN ({...}) por jugada/variante.
- La línea principal del PGN = la partida realmente jugada.
- Campos OTB (white/black/result/round/board/time_control/my_color/played_on) en las columnas de
  `games` que ya existen (de Fase 1). NO se necesita cambiar el esquema.
- Nota: una partida es una partida (no una tarjeta). El árbol JSON de `variations` es de las
  tarjetas; aquí las variantes viven en el PGN. Reusar el COMPONENTE de edición de árbol, pero
  serializar a PGN al guardar.

## 6. Reutilización (qué ya existe y se enchufa)

- Editor de variantes (árbol, colores, notas, borrar nodo) → modo edición del tablero.
- Motor on-device (stockfish.wasm) → botón "Analizar con motor".
- Formulario de datos OTB (round/board/time_control/my_color) → ya está en "Anotar partida" actual.
- Conversión a/desde PGN con chess.js (incluye sidelines y comentarios).

## 7. Listo cuando
- [ ] `pnpm --filter web build` limpio; datos intactos; esquema sin cambios.
- [ ] "Nueva partida" abre tablero; recreas una partida moviendo piezas.
- [ ] Agregas una variante ("¿qué pude jugar?") y la marcas/promueves a principal correctamente.
- [ ] "Analizar con motor" evalúa la posición actual.
- [ ] Notas general + por línea se guardan.
- [ ] Al guardar, el formulario captura datos por partida y hereda ritmo/torneo.
- [ ] La partida queda en `games` como PGN (con sidelines y comentarios); se relee bien al abrirla.
- [ ] El "pegar PGN" anterior sigue funcionando igual.

## 8. Decisiones cerradas
1. Almacenamiento: **PGN** (sidelines + comentarios). No árbol JSON aquí.
2. **Convive** con el pegar-PGN; "Nueva partida" es la entrada por tablero.
3. Línea principal = partida real; alternativas como variantes; **"Promover a principal"** estilo ChessBase.
