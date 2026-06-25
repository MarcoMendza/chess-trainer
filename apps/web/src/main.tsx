import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { seedIfNeeded } from "./study/seed.ts";

// Siembra idempotente del mazo de finales en el primer arranque (no bloquea el render).
seedIfNeeded().catch((err) => console.error("Seed falló:", err));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
