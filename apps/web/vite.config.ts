import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Headers necesarios para que stockfish.wasm multihilo funcione (Fase 3).
// Se dejan configurados desde Fase 1 (CLAUDE.md / FASE-0): habilitan crossOriginIsolated.
const crossOriginIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Permite probar el service worker también en `vite dev`.
      devOptions: { enabled: true },
      manifest: {
        name: "Chess Trainer",
        short_name: "Chess",
        description: "Estudio de ajedrez local-first: torneos, partidas y repaso FSRS.",
        theme_color: "#1f2937",
        background_color: "#111827",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" },
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
});
