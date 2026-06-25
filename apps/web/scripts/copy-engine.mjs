// Copia el build de Stockfish a public/engine/ con los nombres que el motor espera por
// defecto (su locateFile resuelve `stockfish.wasm` y `stockfish.worker.js` relativos al
// script). Así se sirven same-origin y COEP `require-corp` no los bloquea.
//
// Se usa el build **lite multihilo NNUE** (~7 MB), no el completo (~113 MB): demasiado
// pesado para el cel. El motor sigue siendo NNUE multihilo, solo con una red más chica.
//
// Enganchado a `predev` y `prebuild`. Los archivos NO se commitean (.gitignore): se
// regeneran desde node_modules, única fuente (paquete oficial de npm).

import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, "..");
const outDir = join(webRoot, "public", "engine");

// Resuelve la carpeta del paquete stockfish vía su package.json (robusto a hoisting).
const require = createRequire(import.meta.url);
const pkgJson = require.resolve("stockfish/package.json");
const binDir = join(dirname(pkgJson), "bin");

const BUILD = "stockfish-18-lite"; // lite multihilo NNUE
const srcJs = join(binDir, `${BUILD}.js`);
const srcWasm = join(binDir, `${BUILD}.wasm`);

for (const f of [srcJs, srcWasm]) {
  if (!existsSync(f)) {
    console.error(`[copy-engine] No encuentro ${f}. ¿Está instalado el paquete 'stockfish'?`);
    process.exit(1);
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// stockfish.js: script principal (también se carga como worker UCI).
copyFileSync(srcJs, join(outDir, "stockfish.js"));
// stockfish.worker.js: el motor crea los pthreads desde este nombre; es el mismo script.
copyFileSync(srcJs, join(outDir, "stockfish.worker.js"));
// stockfish.wasm: binario que locateFile busca como `stockfish.wasm`.
copyFileSync(srcWasm, join(outDir, "stockfish.wasm"));

console.log(`[copy-engine] ${BUILD} → public/engine/ (stockfish.js, stockfish.worker.js, stockfish.wasm)`);
