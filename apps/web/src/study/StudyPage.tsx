import { type ReactNode, useState } from "react";
import DayReview from "./DayReview.tsx";
import PracticePanel from "./PracticePanel.tsx";

type StudyTab = "day" | "practice";

export default function StudyPage() {
  const [tab, setTab] = useState<StudyTab>("day");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Estudiar</h1>

      {/* Dos modos claramente distintos: repaso oficial (mueve FSRS) vs práctica libre. */}
      <div className="flex gap-1.5">
        <TabButton active={tab === "day"} onClick={() => setTab("day")}>
          Repaso del día
        </TabButton>
        <TabButton active={tab === "practice"} onClick={() => setTab("practice")}>
          Práctica
        </TabButton>
      </div>

      {tab === "day" ? <DayReview /> : <PracticePanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
        active
          ? "border-emerald-500 bg-emerald-600 text-white"
          : "border-gray-600 text-gray-300 active:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
