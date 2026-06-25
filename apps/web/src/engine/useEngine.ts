import { useCallback, useEffect, useRef, useState } from "react";
import { Engine, mobileDefaults, type EngineLine } from "./engine.ts";

/** Línea de análisis con el score ya en óptica de blancas (lista para mostrar). */
export type WhitePovLine = EngineLine;

function sideToMove(fen: string): "w" | "b" {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

/**
 * Hook que gestiona el ciclo de vida del motor en un Web Worker.
 * Normaliza el score a blancas: el motor lo da relativo al lado que mueve, así que si en la
 * posición analizada mueven negras, se invierte el signo (cp y mate).
 */
export function useEngine() {
  const engineRef = useRef<Engine | null>(null);
  // Lado a mover de la posición en análisis, para normalizar el score que llega en streaming.
  const turnRef = useRef<"w" | "b">("w");
  const [ready, setReady] = useState(false);
  const [lines, setLines] = useState<WhitePovLine[]>([]);
  const [multipv, setMultipvState] = useState(mobileDefaults().multipv);

  useEffect(() => {
    const engine = new Engine();
    engineRef.current = engine;
    engine.onLines = (raw) => {
      const flip = turnRef.current === "b";
      setLines(
        raw.map((l) =>
          flip
            ? {
                ...l,
                scoreCp: l.scoreCp == null ? undefined : -l.scoreCp,
                scoreMate: l.scoreMate == null ? undefined : -l.scoreMate,
              }
            : l,
        ),
      );
    };
    engine
      .init()
      .then(() => setReady(true))
      .catch((err) => console.error("Motor: fallo al iniciar", err));
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const analyze = useCallback((fen: string, movetime?: number) => {
    turnRef.current = sideToMove(fen);
    engineRef.current?.analyze(fen, movetime);
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setLines([]);
  }, []);

  const setMultipv = useCallback((n: number) => {
    setMultipvState(n);
    engineRef.current?.setMultiPV(n);
  }, []);

  return { ready, lines, analyze, stop, multipv, setMultipv };
}
