import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { tryLoadPgn } from "../board/useChess.ts";
import { createGame, extractPgnHeaders } from "./repo.ts";
import type { Color } from "../db/schema.ts";

const inputClass =
  "w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm outline-none focus:border-emerald-500";

interface FormState {
  white: string;
  black: string;
  result: string;
  played_on: string;
  round: string;
  board: string;
  time_control: string;
  my_color: "" | Color;
  eco: string;
  pgn: string;
}

const empty: FormState = {
  white: "",
  black: "",
  result: "*",
  played_on: "",
  round: "",
  board: "",
  time_control: "",
  my_color: "",
  eco: "",
  pgn: "",
};

export default function GameFormPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function autofillFromPgn() {
    const headers = extractPgnHeaders(form.pgn);
    if (!headers) {
      setError("No pude leer el PGN para autocompletar.");
      return;
    }
    setError(null);
    setForm((f) => ({
      ...f,
      white: headers.white ?? f.white,
      black: headers.black ?? f.black,
      result: headers.result ?? f.result,
      played_on: headers.played_on ?? f.played_on,
      eco: headers.eco ?? f.eco,
      round: headers.round ?? f.round,
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!collectionId) return;
    if (!form.pgn.trim()) {
      setError("El PGN es obligatorio: es la fuente de verdad de la partida.");
      return;
    }
    const parsed = tryLoadPgn(form.pgn);
    if (!parsed.ok) {
      setError(`PGN inválido: ${parsed.error}`);
      return;
    }
    await createGame({
      collection_id: collectionId,
      pgn: form.pgn.trim(),
      white: form.white || undefined,
      black: form.black || undefined,
      result: form.result || undefined,
      played_on: form.played_on || undefined,
      round: form.round || undefined,
      board: form.board || undefined,
      time_control: form.time_control || undefined,
      my_color: form.my_color || undefined,
      eco: form.eco || undefined,
      source: "OTB",
    });
    navigate(`/torneos/${collectionId}`);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/torneos/${collectionId}`} className="text-sm text-gray-400">
          ← Volver
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Anotar partida</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-gray-300">PGN (fuente de verdad)</span>
          <textarea
            value={form.pgn}
            onChange={(e) => set("pgn", e.target.value)}
            rows={5}
            placeholder="Pega aquí el PGN de la partida…"
            className={`${inputClass} font-mono`}
          />
        </label>
        <button
          type="button"
          onClick={autofillFromPgn}
          className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-200 active:bg-gray-700"
        >
          Detectar datos del PGN
        </button>

        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Blancas">
            <input className={inputClass} value={form.white} onChange={(e) => set("white", e.target.value)} />
          </Labeled>
          <Labeled label="Negras">
            <input className={inputClass} value={form.black} onChange={(e) => set("black", e.target.value)} />
          </Labeled>
          <Labeled label="Resultado">
            <select className={inputClass} value={form.result} onChange={(e) => set("result", e.target.value)}>
              <option value="*">*</option>
              <option value="1-0">1-0</option>
              <option value="0-1">0-1</option>
              <option value="1/2-1/2">1/2-1/2</option>
            </select>
          </Labeled>
          <Labeled label="Mi color">
            <select
              className={inputClass}
              value={form.my_color}
              onChange={(e) => set("my_color", e.target.value as FormState["my_color"])}
            >
              <option value="">—</option>
              <option value="w">Blancas</option>
              <option value="b">Negras</option>
            </select>
          </Labeled>
          <Labeled label="Ronda">
            <input className={inputClass} value={form.round} onChange={(e) => set("round", e.target.value)} />
          </Labeled>
          <Labeled label="Mesa">
            <input className={inputClass} value={form.board} onChange={(e) => set("board", e.target.value)} />
          </Labeled>
          <Labeled label="Ritmo">
            <input
              className={inputClass}
              value={form.time_control}
              onChange={(e) => set("time_control", e.target.value)}
              placeholder="90+30"
            />
          </Labeled>
          <Labeled label="Fecha">
            <input
              className={inputClass}
              value={form.played_on}
              onChange={(e) => set("played_on", e.target.value)}
              placeholder="2026.06.24"
            />
          </Labeled>
          <Labeled label="ECO">
            <input className={inputClass} value={form.eco} onChange={(e) => set("eco", e.target.value)} />
          </Labeled>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white active:bg-emerald-700"
        >
          Guardar partida
        </button>
      </form>
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
