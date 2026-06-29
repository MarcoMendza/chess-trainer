import { NavLink, Route, Routes } from "react-router-dom";
import StudyPage from "./study/StudyPage.tsx";
import CollectionsPage from "./games/CollectionsPage.tsx";
import CollectionDetailPage from "./games/CollectionDetailPage.tsx";
import GameFormPage from "./games/GameFormPage.tsx";
import NewGamePage from "./games/NewGamePage.tsx";
import GameViewPage from "./games/GameViewPage.tsx";
import ImportPage from "./games/ImportPage.tsx";
import AnalysisPage from "./analysis/AnalysisPage.tsx";
import TrainPage from "./train/TrainPage.tsx";
import TrainThemePage from "./train/TrainThemePage.tsx";
import TagsAdminPage from "./tags/TagsAdminPage.tsx";

const navItems = [
  { to: "/", label: "Estudiar", icon: "♞", end: true },
  { to: "/entrenar", label: "Entrenar", icon: "♟", end: false },
  { to: "/torneos", label: "Torneos", icon: "♜", end: false },
  { to: "/importar", label: "Importar", icon: "♙", end: false },
];

export default function App() {
  return (
    <div className="flex min-h-full flex-col bg-gray-900 text-gray-100">
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="mx-auto w-full max-w-md px-4 pt-4">
          <Routes>
            <Route path="/" element={<StudyPage />} />
            <Route path="/torneos" element={<CollectionsPage />} />
            <Route path="/torneos/:collectionId" element={<CollectionDetailPage />} />
            <Route path="/torneos/:collectionId/nueva" element={<GameFormPage />} />
            <Route path="/torneos/:collectionId/tablero" element={<NewGamePage />} />
            <Route path="/partida/:gameId" element={<GameViewPage />} />
            <Route path="/importar" element={<ImportPage />} />
            <Route path="/analizar" element={<AnalysisPage />} />
            <Route path="/entrenar" element={<TrainPage />} />
            <Route path="/entrenar/temas" element={<TagsAdminPage />} />
            <Route path="/entrenar/:tagId" element={<TrainThemePage />} />
          </Routes>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 border-t border-gray-700 bg-gray-800/95 backdrop-blur">
        <div className="mx-auto flex max-w-md">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-3 text-xs ${
                  isActive ? "text-emerald-400" : "text-gray-400"
                }`
              }
            >
              <span className="text-xl leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
