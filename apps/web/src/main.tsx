import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { ensureDefaultCategories } from "./tags/categories.ts";

// Semilla idempotente de las 5 categorías de fábrica (no bloquea el render).
ensureDefaultCategories().catch((err) => console.error("Categorías: seed falló:", err));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
