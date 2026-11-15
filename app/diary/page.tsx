"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Workout, addDays, createWorkout, fmt, logTemplate, prettyDay, summarize, toDate, today, useLoad } from "@/lib/client";
import { Sheet, WorkoutCard } from "@/components/ui";

export default function Diary() {
  const router = useRouter();
  const [day, setDay] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("day");
    setDay(q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : today());
  }, []);

  const go = (d: string) => {
    setDay(d);
    window.history.replaceState(null, "", `/diary?day=${d}`);
  };

  const { data: workouts, error } = useLoad<Workout[]>(day ? `/api/workouts?kind=workout&from=${day}&to=${day}` : null);
  const { data: templates } = useLoad<Workout[]>(picking ? "/api/workouts?kind=template" : null);
  const s = summarize(workouts ?? []);

  const run = async (make: () => Promise<number>) => {
    if (busy) return;
    setBusy(true);
    try {
      router.push(`/workout/${await make()}`);
    } catch (e: any) {
      alert(e.message);
      setBusy(false);
    }
  };

  if (!day) return null;

  return (
    <>
      <div className="top">
        <h1>Diary</h1>
        {day !== today() && (
          <button className="link" onClick={() => go(today())}>
            Today
          </button>
        )}
      </div>

      <div className="glass card row" style={{ padding: 10 }}>
        <button className="icon-btn" onClick={() => go(addDays(day, -1))} aria-label="Previous day">
          ‹
        </button>
        <label className="grow" style={{ textAlign: "center", position: "relative" }}>
          <div style={{ fontWeight: 750, fontSize: 16 }}>{prettyDay(day)}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {toDate(day).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <input
            type="date"
            value={day}
            onChange={(e) => e.target.value && go(e.target.value)}
            style={{ position: "absolute", inset: 0, opacity: 0, width: "100%" }}
            aria-label="Pick a date"
          />
        </label>
        <button className="icon-btn" onClick={() => go(addDays(day, 1))} aria-label="Next day">
          ›
        </button>
      </div>

      <div className="glass card">
        <div className="summary">
          <div>
            <b>{(workouts ?? []).reduce((n, w) => n + w.exercises.length, 0)}</b>
            <span>Exercises</span>
          </div>
          <div>
            <b>{s.sets}</b>
            <span>Sets</span>
          </div>
          <div>
            <b>{fmt(Math.round(s.volume))}</b>
            <span>Volume (kg)</span>
          </div>
        </div>
      </div>

      {error && <div className="glass error">{error}</div>}
      {workouts && !workouts.length && <div className="glass card empty">No workout logged on this day.</div>}
      {(workouts ?? []).map((w) => (
        <WorkoutCard key={w.id} w={w} detail />
      ))}

      <div className="row" style={{ marginTop: 6 }}>
        <button
          className="btn grow"
          disabled={busy}
          onClick={() => run(() => createWorkout({ kind: "workout", name: "", day, finished: day !== today(), exercises: [] }))}
        >
          + New workout
        </button>
        <button className="btn ghost grow" onClick={() => setPicking(true)}>
          ★ Log favourite
        </button>
      </div>

      {picking && (
        <Sheet title={`Log a favourite · ${prettyDay(day)}`} onClose={() => setPicking(false)}>
          {templates && !templates.length && (
            <div className="empty">No favourites yet. Create one in the Favourites tab.</div>
          )}
          {templates && templates.length > 0 && (
            <div className="glass list">
              {templates.map((t) => (
                <button key={t.id} className="item" disabled={busy} onClick={() => run(() => logTemplate(t, day))}>
                  <div>
                    <div className="name">{t.name || "Untitled favourite"}</div>
                    <div className="meta">{t.exercises.map((x) => x.name).join(", ") || "No exercises"}</div>
                  </div>
                  <span className="chev">›</span>
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
