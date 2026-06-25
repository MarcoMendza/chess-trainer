# Chess Trainer

App de estudio de ajedrez, autodidacta y **local-first**: corre completa en el celular sin red,
con respaldo/sync opcional a un NAS y puente a ChessBase (fases posteriores).

> Estado actual: **Fase 1 — MVP local**. Funciona offline, todo se guarda en el dispositivo
> (IndexedDB). Sin servidor ni sincronización todavía.

## Qué hace (Fase 1)

- **Tablero** con [chessground](https://github.com/lichess-org/chessground) y legalidad/PGN/FEN
  vía [chess.js](https://github.com/jhlywa/chess.js).
- **Torneos**: crea torneos y anota partidas OTB con ronda, mesa, ritmo y color con el que jugaste.
  El PGN es la fuente de verdad de cada partida.
- **Importar** PGN o cargar un FEN y explorar la posición.
- **Estudiar** con repetición espaciada **FSRS** ([ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)):
  ver posición → revelar la idea → calificar (1–4). Incluye un mazo de ejemplo de finales clásicos.
- **PWA** instalable, con los headers COOP/COEP ya configurados (preparado para el motor on-device
  en una fase futura).

## Stack

| Capa | Tecnología |
|------|-----------|
| App | React + Vite (PWA), TypeScript, Tailwind CSS |
| Ajedrez | chess.js (legalidad/PGN/FEN), chessground (tablero) |
| Datos | Dexie sobre IndexedDB |
| Repaso | FSRS (ts-fsrs) |

## Estructura

Monorepo con **pnpm workspaces**:

```
chess-trainer/
├── apps/
│   ├── web/                 # PWA (esta fase)
│   │   └── src/
│   │       ├── board/       # tablero (chessground + chess.js)
│   │       ├── db/          # esquema Dexie (IndexedDB)
│   │       ├── games/       # torneos, anotar/importar partidas, cargar FEN
│   │       ├── study/       # tarjetas + scheduler FSRS
│   │       └── sync/        # cliente de sync (fase posterior)
│   └── server/              # placeholder (fase posterior)
└── packages/
    └── shared/              # tipos/esquema compartidos (fase posterior)
```

## Requisitos

- Node.js >= 20
- pnpm >= 9

## Desarrollo

```sh
pnpm install

# servidor de desarrollo
pnpm --filter web dev
# para abrir desde el celular en la misma red:
pnpm --filter web dev --host

# chequeo de tipos
pnpm --filter web typecheck

# build de producción
pnpm --filter web build
```

## Roadmap

- **Fase 1** — MVP local (tablero, torneos, importar PGN/FEN, FSRS). ✅
- **Fase 2** — Sync con NAS y puente a ChessBase.
- **Fase 3** — Análisis on-device (motor en el navegador, barra de evaluación).
- **Fase 4** — Colecciones por tema, interleaving, dashboard, notación en español.
