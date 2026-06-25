import { parseUci, type UciInfo } from "./uci.ts";

/** URL del worker del motor (servido same-origin desde public/engine, ver copy-engine.mjs). */
export const ENGINE_URL = "/engine/stockfish.js";

/** Una línea de análisis tal cual la reporta el motor (score relativo al lado que mueve). */
export interface EngineLine {
  multipv: number;
  depth: number;
  scoreCp?: number;
  scoreMate?: number;
  pvUci: string[];
}

export interface EngineSettings {
  threads: number;
  hash: number; // MB
  multipv: number;
}

/** Settings pensados para el cel (NO los de desktop): pocos hilos, hash chico. */
export function mobileDefaults(): EngineSettings {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 1 : 1;
  return {
    threads: Math.max(1, Math.min(3, cores)),
    hash: 64,
    multipv: 3,
  };
}

/** Tiempo de búsqueda por posición (ms). Acotado: nunca `go infinite` sin freno. */
export const DEFAULT_MOVETIME = 1500;

type LinesListener = (lines: EngineLine[]) => void;

interface Waiter {
  match: (msg: ReturnType<typeof parseUci>) => boolean;
  resolve: () => void;
}

/**
 * Envuelve el worker de Stockfish y habla UCI. Mantiene las líneas MultiPV de la búsqueda
 * en curso y las emite por callback. Cancela la búsqueda previa (`stop`) antes de cada `go`.
 */
export class Engine {
  private worker: Worker;
  private waiters: Waiter[] = [];
  private lines = new Map<number, EngineLine>();
  private settings: EngineSettings;
  private searching = false;
  private ready = false;
  onLines: LinesListener | null = null;

  constructor(settings: EngineSettings = mobileDefaults()) {
    this.settings = settings;
    this.worker = new Worker(ENGINE_URL);
    this.worker.onmessage = (e: MessageEvent) => {
      if (typeof e.data === "string") this.handleLine(e.data);
    };
  }

  private send(cmd: string): void {
    this.worker.postMessage(cmd);
  }

  private handleLine(raw: string): void {
    const msg = parseUci(raw);

    // Despierta a quien espere por este mensaje (uciok/readyok).
    this.waiters = this.waiters.filter((w) => {
      if (w.match(msg)) {
        w.resolve();
        return false;
      }
      return true;
    });

    if (msg.type === "info") {
      this.collect(msg);
    } else if (msg.type === "bestmove") {
      this.searching = false;
    }
  }

  private collect(info: UciInfo): void {
    if (info.pvUci.length === 0 || (info.scoreCp == null && info.scoreMate == null)) return;
    this.lines.set(info.multipv, {
      multipv: info.multipv,
      depth: info.depth ?? 0,
      scoreCp: info.scoreCp,
      scoreMate: info.scoreMate,
      pvUci: info.pvUci,
    });
    this.emit();
  }

  private emit(): void {
    const sorted = [...this.lines.values()].sort((a, b) => a.multipv - b.multipv);
    this.onLines?.(sorted);
  }

  private waitFor(match: Waiter["match"]): Promise<void> {
    return new Promise((resolve) => this.waiters.push({ match, resolve }));
  }

  /** Handshake UCI + opciones. Idempotente. */
  async init(): Promise<void> {
    if (this.ready) return;
    this.send("uci");
    await this.waitFor((m) => m.type === "uciok");
    this.applySettings();
    this.send("isready");
    await this.waitFor((m) => m.type === "readyok");
    this.ready = true;
  }

  private applySettings(): void {
    this.send(`setoption name Threads value ${this.settings.threads}`);
    this.send(`setoption name Hash value ${this.settings.hash}`);
    this.send(`setoption name MultiPV value ${this.settings.multipv}`);
  }

  /** Analiza una posición. Cancela la búsqueda anterior antes de empezar la nueva. */
  analyze(fen: string, movetime = DEFAULT_MOVETIME): void {
    if (!this.ready) return;
    if (this.searching) this.send("stop");
    this.lines.clear();
    this.emit();
    this.send(`position fen ${fen}`);
    this.send(`go movetime ${movetime}`);
    this.searching = true;
  }

  stop(): void {
    if (this.searching) this.send("stop");
  }

  setMultiPV(n: number): void {
    this.settings.multipv = n;
    if (this.ready) this.send(`setoption name MultiPV value ${n}`);
  }

  dispose(): void {
    try {
      this.send("quit");
    } catch {
      /* worker ya terminado */
    }
    this.worker.terminate();
  }
}
