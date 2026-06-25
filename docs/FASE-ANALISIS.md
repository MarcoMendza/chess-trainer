# Fase Análisis — Tablero de análisis + motor on-device

Tablero tipo Lichess (mover libre + Stockfish) corriendo 100% en el cel. Sin red, sin NAS.

> Nota: la antigua Fase 2 (sync + NAS) queda **aparcada** por decisión del proyecto.
> La app es local-first y el puente a ChessBase, si se necesita, es export manual de PGN.

---

## 1. Objetivo

Un tablero donde mueves piezas libremente, exploras variantes y Stockfish evalúa en tiempo real.
Cubre el lado de *aplicación* del estudio (no solo recordar la idea, sino encontrar la jugada).

## 2. Alcance v1

INCLUYE:
- Tablero de análisis: movimiento libre legal (chess.js valida, chessground arrastra).
- Navegación: atrás/adelante + lista de jugadas.
- Motor Stockfish (wasm, multihilo NNUE) en un Web Worker, vía UCI.
- Evaluación en vivo: barra + número (cp/mate) normalizado a blancas + flecha de mejor jugada.
- MultiPV: 3 líneas por defecto, configurable (1-3).
- Entrada "Analizar" desde Importar (PGN/FEN cargado) y desde una partida de Torneos.
- Desbloquea la tarjeta `best_move`: guardas posición, das tu jugada, el motor la verifica.

NO incluye (después):
- Árbol de variantes con ramas guardadas (v1 es **lineal**: al mover desde un punto intermedio
  se reemplaza la continuación; no se guardan sidelines).
- Sync / NAS / tags / dashboard.

## 3. Sub-pasos (orden de construcción)

1. Tablero de análisis con movimiento libre + lista de jugadas + atrás/adelante.
2. Worker del motor: cargar stockfish.wasm, handshake UCI, `isready`.
3. Evaluación: parsear `info` (depth, score cp/mate, pv, multipv) → barra + número + flecha.
4. MultiPV: mostrar las N mejores líneas; selector 1-3.
5. Conectar "Analizar" desde Importar y Torneos, reusando el mismo componente de tablero.
6. Tarjeta `best_move`: comparar la jugada del usuario contra la mejor del motor (con umbral).

## 4. Settings del motor en el cel (NO usar los de desktop)

- Threads: 2-3 (no los 10 de desktop). Tope: `min(3, hardwareConcurrency)`.
- Hash: 64-128 MB (no 4 GB).
- Búsqueda acotada: por tiempo (~1-2 s) o profundidad, no `go infinite` sin freno.
- Al cambiar de posición o mover: enviar `stop` antes del nuevo `go` (cancelar la búsqueda previa).
- Objetivo: que el S26 no se caliente ni funda batería en una sesión de estudio.

## 5. Detalles técnicos que muerden (van en el prompt)

- Multihilo wasm requiere `crossOriginIsolated = true` → COOP/COEP. Ya configurado en Fase 1, se reusa.
- El motor corre en Web Worker para no congelar la UI; el wasm a su vez lanza sus propios pthreads.
- Score de Stockfish es relativo al lado que mueve → invertir signo si juegan negras, para mostrar
  siempre desde la óptica de blancas.
- MultiPV multiplica el cómputo; mantener líneas en 3 y la búsqueda acotada en móvil.

## 6. Listo cuando

- [ ] En el cel cargas un FEN/PGN, das "Analizar", mueves libre y el motor evalúa en vivo.
- [ ] La barra + número + flecha de mejor jugada se actualizan al mover, sin trabar la UI.
- [ ] MultiPV muestra 3 líneas y se puede bajar a 1.
- [ ] El S26 no se sobrecalienta en una sesión normal.
- [ ] (Bonus) Guardas una posición como tarjeta `best_move` y el motor verifica tu jugada.

## 7. Decisiones cerradas

1. Build: **Stockfish multihilo NNUE** (reusa COOP/COEP).
2. Variantes: **lineal en v1** (sin árbol de ramas).
3. Eval: **barra + mejor jugada + MultiPV (3, configurable)**.
4. Entrada: **"Analizar" desde Importar y Torneos**, reusando el tablero.

