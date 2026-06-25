import { db } from "../db/db.ts";
import { newRow } from "../db/helpers.ts";
import type { Deck } from "../db/schema.ts";
import { createPositionWithCard } from "./repo.ts";

const DECK_NAME = "100 Finales (De la Villa)";

interface SeedPosition {
  fen: string;
  idea: string;
  eval_note: string;
}

// Semilla de EJEMPLO (no los 100 reales): finales clásicos para arrancar el SRS.
const FINALES: SeedPosition[] = [
  {
    fen: "8/8/4k3/8/4P3/4K3/8/8 w - - 0 1",
    idea: "Toma la oposición y lleva el rey delante del peón antes de empujar.",
    eval_note: "Ganan las blancas si logran la oposición; tablas si no.",
  },
  {
    fen: "7k/8/8/8/8/8/P7/6K1 w - - 0 1",
    idea: "Regla del cuadrado: ¿el rey negro entra al cuadrado del peón?",
    eval_note: "El peón corona si el rey no alcanza el cuadrado.",
  },
  {
    fen: "8/8/3k4/8/3PP3/3K4/8/8 w - - 0 1",
    idea: "Peones conectados: avanzan apoyándose, el rey no hace falta para empujar.",
    eval_note: "Ventaja decisiva blanca.",
  },
  {
    fen: "2K5/2P1k3/8/8/8/8/r7/3R4 w - - 0 1",
    idea: "Posición de Lucena: construye el puente para que el rey escape de los jaques.",
    eval_note: "Ganan las blancas (técnica del puente).",
  },
  {
    fen: "6r1/8/8/4k3/8/4K3/4P3/4R3 w - - 0 1",
    idea: "Defensa de Philidor: mantén la torre en la 3ª fila hasta que el peón avance.",
    eval_note: "Tablas con la técnica correcta del bando débil.",
  },
  {
    fen: "R7/3P4/8/8/8/8/r7/3K2k1 w - - 0 1",
    idea: "La torre va DETRÁS del peón pasado (propio o rival).",
    eval_note: "Principio de Tarrasch; favorece a las blancas.",
  },
  {
    fen: "8/8/4k3/8/2b5/4P3/3K1B2/8 w - - 0 1",
    idea: "Alfiles de distinto color: el bando fuerte casi nunca gana un solo peón.",
    eval_note: "Tendencia clara a tablas.",
  },
  {
    fen: "8/8/8/8/8/5k2/6p1/6KN w - - 0 1",
    idea: "Caballo frenando al peón: cuidado con el peón de torre y el ahogado.",
    eval_note: "Defendible para las blancas con maniobras precisas.",
  },
];

/**
 * Siembra idempotente: si el mazo de finales no existe, lo crea junto con sus
 * posiciones y tarjetas (estado `new`, vencidas para repasar ya). Si ya existe, no hace nada.
 */
export async function seedIfNeeded(): Promise<void> {
  const decks = await db.decks.where("deleted").equals(0).toArray();
  if (decks.some((d) => d.name === DECK_NAME)) return;

  const deck: Deck = {
    ...newRow(),
    name: DECK_NAME,
    description: "Mazo de ejemplo con finales clásicos para empezar a entrenar.",
  };
  await db.decks.add(deck);

  for (const f of FINALES) {
    await createPositionWithCard({
      fen: f.fen,
      deckId: deck.id,
      cardType: "idea",
      idea: f.idea,
      evalNote: f.eval_note,
    });
  }
}
