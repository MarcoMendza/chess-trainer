import { db } from "../db/db.ts";
import type { AppSettings } from "../db/schema.ts";

// Settings locales de la app (registro singleton `id="app"`). Hoy solo el cupo de
// tarjetas nuevas por día de Estudiar (ver docs/FASE-ESTUDIAR.md §3).

const DEFAULT_NEW_PER_DAY = 10;

/** Fecha local en "YYYY-MM-DD" (los contadores diarios son por día local del dispositivo). */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lee el singleton, creándolo con valores por defecto la primera vez. */
export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get("app");
  if (existing) return existing;
  const fresh: AppSettings = {
    id: "app",
    newPerDayDefault: DEFAULT_NEW_PER_DAY,
    studyDay: "", // sin día asignado todavía → fuerza el prompt la primera vez
    newGoalToday: 0,
    newDoneToday: 0,
  };
  await db.settings.put(fresh);
  return fresh;
}

/** ¿Toca preguntar "¿cuántas nuevas hoy?" (primera vez del día)? */
export function needsNewPrompt(s: AppSettings, today = todayStr()): boolean {
  return s.studyDay !== today;
}

/**
 * Fija el cupo de nuevas para hoy (al responder el prompt): resetea el contador del día
 * y recuerda la cantidad como nuevo default para próximos días.
 */
export async function setNewGoalToday(goal: number): Promise<AppSettings> {
  const today = todayStr();
  const s = await getSettings();
  const next: AppSettings = {
    ...s,
    studyDay: today,
    newGoalToday: goal,
    newDoneToday: 0,
    newPerDayDefault: goal,
  };
  await db.settings.put(next);
  return next;
}

/** Suma 1 a las nuevas introducidas hoy (al calificar una tarjeta que estaba en `new`). */
export async function incNewDone(): Promise<void> {
  const s = await getSettings();
  if (s.studyDay !== todayStr()) return; // día desfasado: lo ajustará el próximo prompt
  await db.settings.update("app", { newDoneToday: s.newDoneToday + 1 });
}

/** Cupo de nuevas que aún caben hoy. */
export function remainingNew(s: AppSettings): number {
  return Math.max(0, s.newGoalToday - s.newDoneToday);
}
