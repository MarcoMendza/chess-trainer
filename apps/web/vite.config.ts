import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

// Headers necesarios para que stockfish.wasm multihilo funcione (Fase 3).
// Se dejan configurados desde Fase 1 (CLAUDE.md / FASE-0): habilitan crossOriginIsolated.
const crossOriginIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [
    // HTTPS en dev: el cel accede por IP (no localhost), que de otro modo NO es secure
    // context. Sin secure context fallan crypto.randomUUID(), el service worker y
    // crossOriginIsolated. basic-ssl genera un cert autofirmado (el cel pedirá confiar una vez).
    basicSsl(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Permite probar el service worker también en `vite dev`.
      devOptions: { enabled: true },
      workbox: {
        // El binario del motor (~7 MB) NO se precachea en la instalación: se descarga
        // bajo demanda y se cachea tras el primer uso (CacheFirst) para soporte offline.
        globIgnores: ["**/engine/**"],
        navigateFallbackDenylist: [/^\/engine\//, /\/[^/?]+\.[^/]+$/],
        runtimeCaching: [
          {
            urlPattern: /\/engine\/.*\.(?:js|wasm)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "stockfish-engine",
              expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
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
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
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
