"use client";

import { useCallback, useEffect, useState } from "react";

export type Exercise = { id: number; name: string; muscle: string; equipment: string; is_custom: boolean };
export type WSet = { weight: number | null; reps: number | null };
export type WExercise = { exercise_id: number; name: string; muscle: string; sets: WSet[] };
export type Workout = {
  id: number;
  kind: "workout" | "template";
  name: string;
  day: string;
  finished: boolean;
  exercises: WExercise[];
};
export type HistoryEntry = { workout_id: number; day: string; name: string; sets: WSet[] };

export const MUSCLE_COLORS: Record<string, string> = {
  Chest: "#ef5b5b",
  Back: "#3b82f6",
  Shoulders: "#f59e0b",
  Biceps: "#10b981",
  Triceps: "#8b5cf6",
  Forearms: "#14b8a6",
  Quads: "#ec4899",
  Hamstrings: "#f97316",
  Glutes: "#d946ef",
  Calves: "#06b6d4",
  Abs: "#84cc16",
};

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  // Passcode cookie missing or expired: back to the unlock screen.
  if (res.status === 401 && data?.error === "Locked") window.location.href = "/login";
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    if (!path) return;
    api<T>(path)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [path]);
  useEffect(() => {
    setData(null);
    reload();
  }, [reload]);
  return { data, error, reload };
}

// ---------- dates (local time, stored as YYYY-MM-DD) ----------

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => ymd(new Date());
export const toDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (day: string, n: number) => {
  const d = toDate(day);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
/** Monday of the week containing `day`. */
export const weekStart = (day: string) => addDays(day, -((toDate(day).getDay() + 6) % 7));

export function prettyDay(day: string) {
  if (!day) return "";
  const t = today();
  if (day === t) return "Today";
  if (day === addDays(t, -1)) return "Yesterday";
  if (day === addDays(t, 1)) return "Tomorrow";
  return toDate(day).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// ---------- numbers ----------

export const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString();
export const fmtSet = (s: WSet) => (s.weight ? `${fmt(s.weight)} kg × ${s.reps ?? "–"}` : `${s.reps ?? "–"} reps`);
export const isDone = (s: WSet) => !!s.reps && s.reps > 0;

/** Counts logged sets (reps filled in), volume (kg × reps) and sets per muscle. */
export function summarize(workouts: Workout[]) {
  let sets = 0;
  let volume = 0;
  const byMuscle: Record<string, number> = {};
  for (const w of workouts)
    for (const x of w.exercises)
      for (const s of x.sets)
        if (isDone(s)) {
          sets++;
          volume += (s.weight ?? 0) * (s.reps ?? 0);
          byMuscle[x.muscle] = (byMuscle[x.muscle] ?? 0) + 1;
        }
  return { sets, volume, byMuscle };
}

export async function createWorkout(w: Partial<Workout>): Promise<number> {
  const { id } = await api<{ id: number }>("/api/workouts", { method: "POST", body: JSON.stringify(w) });
  return id;
}

/** Logs a favourite as a completed workout on `day` and returns the new workout id. */
export const logTemplate = (t: Workout, day: string) =>
  createWorkout({ kind: "workout", name: t.name, day, finished: true, exercises: t.exercises });
