import type { WhitePovLine } from "../engine/useEngine.ts";

/** % de la barra (0 = negras ganando, 100 = blancas) a partir del score en óptica de blancas. */
function evalToPercent(line: WhitePovLine | undefined): number {
  if (!line) return 50;
  if (line.scoreMate != null) return line.scoreMate > 0 ? 100 : 0;
  if (line.scoreCp == null) return 50;
  // Sigmoide suave: ±400 cp ≈ casi tope. Mantiene la barra legible.
  const k = 0.0045;
  return 100 / (1 + Math.exp(-k * line.scoreCp));
}

/** Texto del score, siempre desde la óptica de blancas (+ blancas mejor). */
export function formatScore(line: WhitePovLine | undefined): string {
  if (!line) return "0.0";
  if (line.scoreMate != null) {
    return (line.scoreMate > 0 ? "M" : "-M") + Math.abs(line.scoreMate);
  }
  if (line.scoreCp == null) return "0.0";
  const pawns = line.scoreCp / 100;
  return (pawns >= 0 ? "+" : "") + pawns.toFixed(2);
}

export default function EvalBar({ best }: { best: WhitePovLine | undefined }) {
  const whitePct = evalToPercent(best);
  return (
    <div className="flex items-stretch gap-2">
      <div className="relative h-auto w-5 overflow-hidden rounded bg-gray-900">
        {/* Parte de blancas crece desde abajo. */}
        <div
          className="absolute inset-x-0 bottom-0 bg-gray-100 transition-[height] duration-300"
          style={{ height: `${whitePct}%` }}
        />
      </div>
      <div className="flex min-w-[3.5rem] items-center">
        <span className="font-mono text-sm tabular-nums">{formatScore(best)}</span>
      </div>
    </div>
  );
}
