import { useState } from "react";
import Chessground from "../board/Chessground.tsx";
import TagPicker from "../tags/TagPicker.tsx";
import { toColor } from "../board/useChess.ts";
import { saveCard } from "./repo.ts";
import { useVariationTree } from "./useVariationTree.ts";
import VariationTree from "./VariationTree.tsx";
import { hasMoves } from "./variations.ts";
import type { NodeColor } from "../db/schema.ts";

interface SaveCardSheetProps {
  fen: string;
  gameId?: string | null;
  ply?: number;
  onClose: () => void;
  onSaved?: () => void;
}

const inputClass =
  "w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500";

/**
 * Hoja inferior (mobile-first) para sembrar una posición como tarjeta:
 * idea + eval_note + link de video (source_url) + minuto (source_time) + tags.
 */
export default function SaveCardSheet({
  fen,
  gameId,
  ply,
  onClose,
  onSaved,
}: SaveCardSheetProps) {
  const [idea, setIdea] = useState("");
  const [evalNote, setEvalNote] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceTime, setSourceTime] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const orientation = fen.split(" ")[1] === "b" ? "black" : "white";
  const variations = useVariationTree(fen);

  async function onSave() {
    setSaving(true);
    try {
      await saveCard({
        fen,
        gameId: gameId ?? null,
        ply,
        idea: idea.trim() || undefined,
        evalNote: evalNote.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        sourceTime: sourceTime.trim() || undefined,
        tagIds,
        tree: hasMoves(variations.tree) ? variations.tree : undefined,
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
      {/* Toque fuera para cerrar */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="flex-1"
      />
      <div className="max-h-[88vh] space-y-3 overflow-y-auto rounded-t-2xl border-t border-gray-700 bg-gray-900 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Guardar como tarjeta</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-400 active:bg-gray-700"
          >
            Cancelar
          </button>
        </div>

        <div className="cg-mini mx-auto w-40">
          <Chessground fen={fen} orientation={orientation} viewOnly />
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-gray-400">Idea</span>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={2}
            placeholder="¿Cuál es la idea de esta posición?"
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-gray-400">Evaluación (en palabras)</span>
          <input
            value={evalNote}
            onChange={(e) => setEvalNote(e.target.value)}
            placeholder="ventaja / deficiencia…"
            className={inputClass}
          />
        </label>

        <div className="flex gap-2">
          <label className="block flex-1">
            <span className="mb-1 block text-xs text-gray-400">Link del video</span>
            <input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              inputMode="url"
              placeholder="https://…"
              className={inputClass}
            />
          </label>
          <label className="block w-24">
            <span className="mb-1 block text-xs text-gray-400">Minuto</span>
            <input
              value={sourceTime}
              onChange={(e) => setSourceTime(e.target.value)}
              inputMode="numeric"
              placeholder="mm:ss"
              className={inputClass}
            />
          </label>
        </div>

        <div>
          <span className="mb-1 block text-xs text-gray-400">Temas</span>
          <TagPicker value={tagIds} onChange={setTagIds} />
        </div>

        {/* ===== Editor de variantes (opcional) ===== */}
        <div className="space-y-3 rounded-lg border border-gray-700 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Variantes{" "}
              {hasMoves(variations.tree) && (
                <span className="text-xs text-emerald-400">· con árbol</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setEditorOpen((v) => !v)}
              className="rounded-lg border border-gray-600 px-3 py-1 text-xs active:bg-gray-700"
            >
              {editorOpen ? "Ocultar" : "Agregar variante"}
            </button>
          </div>

          {editorOpen && (
            <VariationEditor variations={variations} orientation={orientation} />
          )}
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar tarjeta"}
        </button>
      </div>
    </div>
  );
}

const COLOR_OPTIONS: Array<{ value: NodeColor; label: string; className: string }> = [
  { value: "main", label: "Principal", className: "bg-emerald-600" },
  { value: "sub", label: "Subvariante", className: "bg-amber-600" },
  { value: "conditional", label: "Condicional", className: "bg-sky-600" },
  { value: "bad", label: "Mala", className: "bg-red-600" },
];

/**
 * Tablero interactivo + controles de nodo + árbol en vivo.
 * Construyes la línea moviendo piezas; eliges el nodo en el árbol para colorearlo
 * o anotarlo. La raíz (posición de la tarjeta) no admite color ni nota.
 */
function VariationEditor({
  variations,
  orientation,
}: {
  variations: ReturnType<typeof useVariationTree>;
  orientation: "white" | "black";
}) {
  const turnColor = toColor(
    variations.currentFen.split(" ")[1] === "b" ? "b" : "w",
  );
  return (
    <div className="space-y-3">
      <div className="cg-mini mx-auto w-56">
        <Chessground
          fen={variations.currentFen}
          orientation={orientation}
          turnColor={turnColor}
          dests={variations.dests}
          lastMove={variations.lastMove}
          onMove={variations.play}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={variations.back}
          disabled={variations.atRoot}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700 disabled:opacity-30"
        >
          ◀ Atrás
        </button>
        <button
          type="button"
          onClick={variations.reset}
          disabled={variations.atRoot}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-xs active:bg-gray-700 disabled:opacity-30"
        >
          ⏮ Inicio
        </button>
        <button
          type="button"
          onClick={variations.deleteCurrent}
          disabled={variations.atRoot}
          className="rounded-lg border border-red-700 px-3 py-1.5 text-xs text-red-300 active:bg-red-900/40 disabled:opacity-30"
        >
          🗑 Borrar nodo
        </button>
      </div>

      {/* Controles del nodo seleccionado */}
      {variations.atRoot ? (
        <p className="text-center text-xs text-gray-500">
          Mueve una pieza para empezar la línea principal.
        </p>
      ) : (
        <div className="space-y-2 rounded-lg border border-gray-700 bg-gray-800/60 p-2">
          <div className="grid grid-cols-4 gap-1.5">
            {COLOR_OPTIONS.map((opt) => {
              const active = variations.current.color === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    variations.setColor(active ? null : opt.value)
                  }
                  className={`rounded-lg px-1 py-1.5 text-xs font-medium text-white ${opt.className} ${
                    active ? "ring-2 ring-white" : "opacity-70"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={variations.current.note ?? ""}
            onChange={(e) => variations.setNote(e.target.value)}
            rows={2}
            placeholder="Nota para esta jugada (opcional)"
            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
      )}

      <VariationTree
        tree={variations.tree}
        selectedPath={variations.path}
        onSelect={variations.goToPath}
      />
    </div>
  );
}
