import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createGame } from "./repo.ts";
import { treeToPgn } from "./pgnTree.ts";
import type { Color, VariationNode } from "../db/schema.ts";

const inputClass =
  "w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500";

interface SaveGameSheetProps {
  tree: VariationNode;
  collectionId: string;
  /** Ritmo heredado del torneo (prefill del último juego); editable. */
  defaultTimeControl?: string;
  onClose: () => void;
}

/**
 * Formulario de guardado de una partida anotada en tablero (Fase Anotar §4).
 * Datos por partida + nota general; el árbol se serializa a PGN (sidelines + comentarios)
 * y se persiste en `games`. Ritmo prefilled del torneo (heredado), editable.
 */
export default function SaveGameSheet({
  tree,
  collectionId,
  defaultTimeControl,
  onClose,
}: SaveGameSheetProps) {
  const navigate = useNavigate();
  const [white, setWhite] = useState("");
  const [black, setBlack] = useState("");
  const [result, setResult] = useState("*");
  const [myColor, setMyColor] = useState<"" | Color>("");
  const [round, setRound] = useState("");
  const [board, setBoard] = useState("");
  const [timeControl, setTimeControl] = useState(defaultTimeControl ?? "");
  const [playedOn, setPlayedOn] = useState("");
  const [generalNote, setGeneralNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSave() {
    setSaving(true);
    try {
      const pgn = treeToPgn({
        tree,
        white: white.trim() || undefined,
        black: black.trim() || undefined,
        result,
        date: playedOn.trim() || undefined,
        round: round.trim() || undefined,
        generalNote: generalNote.trim() || undefined,
      });
      const game = await createGame({
        collection_id: collectionId,
        pgn,
        white: white.trim() || undefined,
        black: black.trim() || undefined,
        result: result || undefined,
        played_on: playedOn.trim() || undefined,
        round: round.trim() || undefined,
        board: board.trim() || undefined,
        time_control: timeControl.trim() || undefined,
        my_color: myColor || undefined,
        source: "OTB",
      });
      navigate(`/partida/${game.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="flex-1" />
      <div className="max-h-[88vh] space-y-3 overflow-y-auto rounded-t-2xl border-t border-gray-700 bg-gray-900 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Guardar partida</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 active:bg-gray-700"
          >
            Cancelar
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Blancas">
            <input className={inputClass} value={white} onChange={(e) => setWhite(e.target.value)} />
          </Labeled>
          <Labeled label="Negras">
            <input className={inputClass} value={black} onChange={(e) => setBlack(e.target.value)} />
          </Labeled>
          <Labeled label="Resultado">
            <select className={inputClass} value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="*">*</option>
              <option value="1-0">1-0</option>
              <option value="0-1">0-1</option>
              <option value="1/2-1/2">1/2-1/2</option>
            </select>
          </Labeled>
          <Labeled label="Mi color">
            <select
              className={inputClass}
              value={myColor}
              onChange={(e) => setMyColor(e.target.value as "" | Color)}
            >
              <option value="">—</option>
              <option value="w">Blancas</option>
              <option value="b">Negras</option>
            </select>
          </Labeled>
          <Labeled label="Ronda">
            <input className={inputClass} value={round} onChange={(e) => setRound(e.target.value)} />
          </Labeled>
          <Labeled label="Mesa">
            <input className={inputClass} value={board} onChange={(e) => setBoard(e.target.value)} />
          </Labeled>
          <Labeled label="Ritmo (del torneo)">
            <input
              className={inputClass}
              value={timeControl}
              onChange={(e) => setTimeControl(e.target.value)}
              placeholder="90+30"
            />
          </Labeled>
          <Labeled label="Fecha">
            <input
              className={inputClass}
              value={playedOn}
              onChange={(e) => setPlayedOn(e.target.value)}
              placeholder="2026.06.24"
            />
          </Labeled>
        </div>

        <Labeled label="Nota general de la partida">
          <textarea
            className={inputClass}
            rows={2}
            value={generalNote}
            onChange={(e) => setGeneralNote(e.target.value)}
            placeholder="Comentario general (opcional)"
          />
        </Labeled>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar partida"}
        </button>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      {children}
    </label>
  );
}
