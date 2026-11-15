"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MUSCLES } from "@/lib/seed";
import { Exercise, MUSCLE_COLORS, Workout, fmt, fmtSet, isDone, prettyDay, summarize } from "@/lib/client";

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="sheet-back" onClick={onClose}>
      <div className="sheet glass" onClick={(e) => e.stopPropagation()}>
        <div className="top" style={{ margin: "0 2px 12px" }}>
          <h1 style={{ fontSize: 20 }}>{title}</h1>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="body">{children}</div>
        {footer && <div className="foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Searchable exercise library, grouped by the muscle each exercise hits. */
export function ExerciseList({
  exercises,
  selected,
  onTap,
}: {
  exercises: Exercise[];
  selected?: Set<number>;
  onTap: (e: Exercise) => void;
}) {
  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState("All");

  const groups = useMemo(() => {
    const s = search.trim().toLowerCase();
    return MUSCLES.filter((m) => muscle === "All" || muscle === m)
      .map((m) => ({
        muscle: m as string,
        items: exercises.filter(
          (e) => e.muscle === m && (!s || e.name.toLowerCase().includes(s) || e.equipment.toLowerCase().includes(s))
        ),
      }))
      .filter((g) => g.items.length);
  }, [exercises, search, muscle]);

  return (
    <div>
      <input
        className="input"
        placeholder="Search exercises"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <div className="chips">
        {["All", ...MUSCLES].map((m) => (
          <button key={m} className={`chip ${muscle === m ? "on" : ""}`} onClick={() => setMuscle(m)}>
            {m}
          </button>
        ))}
      </div>
      {!groups.length && <div className="empty">No exercises match.</div>}
      {groups.map((g) => (
        <div key={g.muscle}>
          <div className="group-head">
            <span>
              <span className="dot" style={{ background: MUSCLE_COLORS[g.muscle] }} />
              {g.muscle}
            </span>
            <span>{g.items.length}</span>
          </div>
          <div className="glass list">
            {g.items.map((e) => (
              <button key={e.id} className={`item ${selected?.has(e.id) ? "sel" : ""}`} onClick={() => onTap(e)}>
                <div>
                  <div className="name">{e.name}</div>
                  <div className="meta">
                    {e.equipment}
                    {e.is_custom ? " · Custom" : ""}
                  </div>
                </div>
                {selected ? <span className="check">{selected.has(e.id) ? "✓" : ""}</span> : <span className="chev">›</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorkoutCard({ w, detail, showDay }: { w: Workout; detail?: boolean; showDay?: boolean }) {
  const s = summarize([w]);
  return (
    <Link href={`/workout/${w.id}`} className="glass card wcard">
      <div className="head">
        <div>
          <div className="title">{w.name || (w.kind === "template" ? "Untitled favourite" : "Workout")}</div>
          <div className="stats">
            {showDay && `${prettyDay(w.day)} · `}
            {w.exercises.length} exercise{w.exercises.length === 1 ? "" : "s"} · {s.sets} sets
            {s.volume > 0 && ` · ${fmt(Math.round(s.volume))} kg`}
          </div>
        </div>
        {w.kind === "workout" && !w.finished ? <span className="tag live">In progress</span> : <span className="chev muted">›</span>}
      </div>
      {detail && w.exercises.length > 0 && (
        <div className="lines">
          {w.exercises.map((x, i) => {
            const done = x.sets.filter(isDone);
            return (
              <div key={i}>
                <span>{x.name}</span>
                <span>{done.length ? done.map(fmtSet).join(", ") : `${x.sets.length} sets`}</span>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}
