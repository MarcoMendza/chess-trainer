# Fase 0 — Diseño y cimientos

App de estudio de ajedrez · autodidacta · cel + NAS + ChessBase

---

## 1. Objetivo y principios

- **Local-first**: todo funciona en el cel sin red. El NAS es respaldo/sync, nunca dependencia.
- **El motor corre en el cel** (stockfish.wasm). El NAS solo almacena, no tiene lógica de ajedrez.
- **El PGN es la fuente de verdad** de una partida. Todo lo demás (posiciones, tarjetas) se deriva o referencia.
- **Entregable usable por fase**. Desde Fase 1 ya anotas partidas y estudias en el cel.
- **Un solo usuario, varios dispositivos** → sync simple (last-write-wins), sin servidor de cuentas.

## 2. Stack

| Capa | Tecnología |
|------|-----------|
| App (cel) | React PWA (Vite), chess.js (legalidad/PGN/FEN), stockfish.wasm, Dexie (IndexedDB) |
| Servidor (NAS) | FastAPI + SQLite. "Tonto": solo recibe, guarda y reenvía. Sin lógica de ajedrez. |
| Transporte | HTTPS sobre Tailscale |
| Puente ChessBase | carpeta SMB en el NAS |

Nota: toda la lógica de ajedrez (validar PGN/FEN, normalizar headers, conversión de notación ES)
vive en el cel con `chess.js`, ANTES de mandar al NAS. El NAS no necesita python-chess en Fase 1.
Si más adelante se quiere trabajo pesado en el servidor (importar cursos en lote, generar tarjetas
sin abrir el cel), ahí se evalúa meter python-chess. No antes.

## 3. Modelo de datos

Mismo esquema lógico en IndexedDB (cel, vía Dexie) y SQLite (NAS). DDL de referencia (SQLite):

```sql
-- ===== Colecciones y partidas =====
CREATE TABLE collections (
  id          TEXT PRIMARY KEY,            -- UUID v4 generado en el cliente
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'tournament', -- tournament | study | repertoire
  created_at  INTEGER NOT NULL,            -- epoch ms
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0   -- soft delete para sync
);

CREATE TABLE games (
  id            TEXT PRIMARY KEY,
  collection_id TEXT REFERENCES collections(id),
  pgn           TEXT NOT NULL,             -- PGN completo = fuente de verdad
  white         TEXT,
  black         TEXT,
  result        TEXT,                      -- 1-0 | 0-1 | 1/2-1/2 | *
  played_on     TEXT,                      -- YYYY.MM.DD
  -- campos para torneo OTB (anotar en vivo desde el cel)
  round         TEXT,                      -- ronda
  board         TEXT,                      -- mesa
  time_control  TEXT,                      -- ritmo (ej. 90+30)
  my_color      TEXT,                      -- w | b (con qué color jugaste)
  eco           TEXT,
  source        TEXT,                      -- chess.com | OTB | import
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted       INTEGER NOT NULL DEFAULT 0
);

-- ===== Posiciones (base de las tarjetas) =====
CREATE TABLE positions (
  id            TEXT PRIMARY KEY,
  fen           TEXT NOT NULL,
  game_id       TEXT REFERENCES games(id), -- null si viene de un FEN suelto o de un curso
  ply           INTEGER,                   -- jugada dentro de la partida
  side_to_move  TEXT,                      -- w | b
  card_type     TEXT NOT NULL DEFAULT 'idea', -- idea | best_move
  idea          TEXT,                      -- "¿cuál es la idea?" (texto; tu caso del curso/libro)
  eval_note     TEXT,                      -- ventaja / deficiencia en palabras
  best_move     TEXT,                      -- SAN, solo para card_type = best_move
  source_url    TEXT,                      -- link del video (Chess Enigma, etc.)
  source_time   TEXT,                      -- mm:ss para re-ver y reforzar
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  deleted       INTEGER NOT NULL DEFAULT 0
);

-- ===== Tags / temas (agnóstico al tema: finales, táctica, estrategia, estructura...) =====
CREATE TABLE tags (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,          -- "Clavada", "Profilaxis", "Peones doblados", "f2-f7"
  category  TEXT,                          -- finales | estructura | tactica | apertura | medio
  parent_id TEXT REFERENCES tags(id)       -- Fase Jerarquía: árbol de temas (NULL = raíz; hereda categoría del padre). Tope 4 niveles, sin ciclos.
);
CREATE TABLE position_tags (
  position_id TEXT NOT NULL REFERENCES positions(id),
  tag_id      TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY (position_id, tag_id)
);
CREATE TABLE game_tags (
  game_id TEXT NOT NULL REFERENCES games(id),
  tag_id  TEXT NOT NULL REFERENCES tags(id),
  PRIMARY KEY (game_id, tag_id)
);

-- ===== Mazos y repetición espaciada =====
CREATE TABLE decks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,               -- "100 Finales (De la Villa)"
  description TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);

-- una tarjeta = una posición estudiada dentro de un mazo (estado FSRS)
CREATE TABLE srs_cards (
  id          TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES positions(id),
  deck_id     TEXT REFERENCES decks(id),
  state       TEXT NOT NULL DEFAULT 'new', -- new | learning | review | relearning
  due         INTEGER,                     -- epoch ms del próximo repaso
  stability   REAL,                        -- FSRS
  difficulty  REAL,                        -- FSRS
  reps        INTEGER NOT NULL DEFAULT 0,
  lapses      INTEGER NOT NULL DEFAULT 0,
  last_review INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);

-- log append-only: alimenta FSRS y el dashboard; en sync solo se unen, nunca hay conflicto
CREATE TABLE reviews (
  id          TEXT PRIMARY KEY,
  card_id     TEXT NOT NULL REFERENCES srs_cards(id),
  rating      INTEGER NOT NULL,            -- 1 again | 2 hard | 3 good | 4 easy
  reviewed_at INTEGER NOT NULL,
  elapsed_ms  INTEGER
);

-- ===== Variantes (Fase Variantes; añadido aditivo, NO cambia stores previos) =====
-- Un árbol de variantes por posición. En SQLite (NAS) el árbol viaja como JSON en TEXT;
-- en IndexedDB (cel) Dexie lo guarda como objeto. Misma forma lógica.
CREATE TABLE variations (
  id          TEXT PRIMARY KEY,            -- UUID v4
  position_id TEXT NOT NULL REFERENCES positions(id),
  tree        TEXT NOT NULL,               -- JSON del árbol (ver shape abajo)
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);
-- Shape del nodo (JSON):
--   { "move": "Bd3"|null, "fen": "…", "color": "main"|"sub"|"bad"|"conditional"|null,
--     "note": "texto"|null, "children": [ /* nodos */ ] }
-- La raíz representa el FEN de la tarjeta (move/color/note = null); sus children son las
-- jugadas candidatas. Colores: main=verde, sub=amarillo, bad=rojo, conditional=azul.
-- El "rojo fuera de árbol" no se almacena: se deriva al reproducir.

CREATE INDEX idx_cards_due  ON srs_cards(due);
CREATE INDEX idx_pos_game   ON positions(game_id);
CREATE INDEX idx_games_coll ON games(collection_id);
CREATE INDEX idx_var_pos    ON variations(position_id);
```

Scheduler: **FSRS** (lo que usa Anki hoy, mejor calibrado que SM-2; menos repasos para la misma
retención). Confirmado para Fase 1.

## 4. Contrato de sincronización

- Toda tabla sincronizable lleva `id` (UUID v4 del cliente), `updated_at` (epoch ms) y `deleted` (0/1).
- El cliente guarda un cursor `last_sync_at`.
- **Pull**: `GET /sync?since={last_sync_at}` → filas del servidor con `updated_at > since`.
- **Push**: `POST /sync` con las filas locales cambiadas desde `last_sync_at`.
- **Conflictos**: last-write-wins por fila, comparando `updated_at`. Suficiente para un solo usuario.
- `reviews` es append-only → en sync solo se hace unión (sin conflicto). Es el historial real del SRS.
- Borrar = marcar `deleted = 1` (nunca DELETE físico, para que el borrado se propague).

## 5. Puente ChessBase

- El NAS escribe **un PGN por colección** en `/srv/chess/export/` (carpeta compartida por SMB).
- La VM Windows monta esa misma carpeta SMB → ChessBase importa desde ahí.
- No es "NAS → PC → VM" en tres saltos: el NAS deja el PGN en la carpeta y la VM (que corre en la PC)
  lee esa carpeta. La PC es donde vive la VM, no un eslabón aparte.
- **Vuelta manual**: desde ChessBase exportas PGN a `/srv/chess/import/`; el servidor lo ingiere en el
  siguiente sync. Razón: ChessBase usa `.cbh`, no escribe PGN por sí solo.

## 6. Estructura del repo (monorepo)

```
chess-trainer/
├── CLAUDE.md                 # contexto fijo para Claude Code
├── apps/
│   ├── web/                  # React PWA (corre en el cel)
│   │   └── src/
│   │       ├── board/        # tablero + worker de stockfish.wasm
│   │       ├── study/        # tarjetas + scheduler FSRS
│   │       ├── games/        # colecciones/torneos, anotar partida, import PGN/FEN
│   │       ├── db/           # Dexie (IndexedDB) + esquema
│   │       └── sync/         # cliente de sync (Fase 2)
│   └── server/               # FastAPI + SQLite (corre en el NAS, "tonto")
│       └── app/
│           ├── models/       # SQLAlchemy
│           ├── routers/      # /sync, /export
│           └── chessbase/    # escribe PGN por colección a la carpeta SMB
├── packages/
│   └── shared/               # tipos/esquema compartidos
└── docs/
    └── FASE-0-DISENO.md      # este documento
```

## 7. Fases

- **Fase 1 — MVP local en el cel**: tablero (chess.js) + importar PGN + cargar FEN + anotar partidas
  por torneo + motor FSRS con el mazo de 100 finales sembrado. Offline, sin sync. *Listo cuando:*
  en el cel anotas una partida en un torneo y repasas tarjetas, y se guarda local.
- **Fase 2 — Sync + NAS + puente ChessBase**: FastAPI/SQLite en el NAS por Tailscale, push/pull,
  last-write-wins, export por colección a la carpeta SMB.
- **Fase 3 — Análisis on-device**: stockfish.wasm, barra de eval, tarjeta "¿mejor jugada?" verificada
  por motor, minería de errores de tus partidas.
- **Fase 4 — Colecciones/Entrenar/retención**: tags, ver por tema, modo intercalado (interleaving),
  dashboard, notación ES, PWA instalable.
- **Fase 5 — opcional**: importar material en lote, ligar videos con timestamp.

## 8. Decisiones cerradas

1. Scheduler: **FSRS** desde Fase 1.
2. Lógica de ajedrez: **chess.js en el cel**; **NAS tonto** (FastAPI + SQLite, sin python-chess por ahora).
3. Export a ChessBase: **un PGN por colección**.
4. `games` incluye **round / board / time_control / my_color** para torneos OTB.
5. Primer mazo de prueba: **100 finales (De la Villa)**.
6. **Variantes** (Fase Variantes): árbol como JSON en tabla `variations`, una por `position_id`.
   Migración aditiva (Dexie v2: solo añade el store, conserva los demás). Detalle: `docs/FASE-VARIANTES.md`.
