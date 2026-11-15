"use client";

import Link from "next/link";
import { useState } from "react";
import { MUSCLES } from "@/lib/seed";
import { Exercise, HistoryEntry, api, fmtSet, prettyDay, useLoad } from "@/lib/client";
import { ExerciseList, Sheet } from "@/components/ui";

export default function Exercises() {
  const { data: exercises, error, reload } = useLoad<Exercise[]>("/api/exercises");
  const [open, setOpen] = useState<Exercise | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="top">
        <div>
          <div className="sub">{exercises ? `${exercises.length} exercises by muscle` : "Loading…"}</div>
          <h1>Exercises</h1>
        </div>
        <button className="btn small" onClick={() => setAdding(true)}>
          + New
        </button>
      </div>

      {error && <div className="glass error">{error}</div>}
      {exercises && <ExerciseList exercises={exercises} onTap={setOpen} />}

      {open && <History exercise={open} onClose={() => setOpen(null)} onDeleted={() => (setOpen(null), reload())} />}
      {adding && <NewExercise onClose={() => setAdding(false)} onSaved={() => (setAdding(false), reload())} />}
    </>
  );
}

function History({ exercise, onClose, onDeleted }: { exercise: Exercise; onClose: () => void; onDeleted: () => void }) {
  const { data } = useLoad<{ history: HistoryEntry[] }>(`/api/exercises/${exercise.id}`);
  const best = (data?.history ?? [])
    .flatMap((h) => h.sets)
    .reduce<{ weight: number; reps: number } | null>(
      (b, s) => (s.weight && s.reps && (!b || s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps)) ? { weight: s.weight, reps: s.reps } : b),
      null
    );

  const remove = async () => {
    if (!confirm(`Delete "${exercise.name}"?`)) return;
    try {
      await api(`/api/exercises/${exercise.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <Sheet
      title={exercise.name}
      onClose={onClose}
      footer={
        exercise.is_custom && (
          <button className="btn danger block" onClick={remove}>
            Delete custom exercise
          </button>
        )
      }
    >
      <div className="muted" style={{ margin: "-6px 2px 12px", fontWeight: 600 }}>
        {exercise.muscle} · {exercise.equipment || "Custom"}
        {best && ` · Best ${fmtSet(best)}`}
      </div>
      {!data && <div className="empty">Loading…</div>}
      {data && !data.history.length && <div className="empty">Not logged yet. Your last sessions will show up here.</div>}
      {data && data.history.length > 0 && (
        <div className="glass list">
          {data.history.map((h, i) => (
            <Link key={i} href={`/workout/${h.workout_id}`} className="item">
              <div>
                <div className="name">{prettyDay(h.day)}</div>
                <div className="meta">{h.sets.map(fmtSet).join(" · ")}</div>
              </div>
              <span className="chev">›</span>
            </Link>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function NewExercise({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<string>(MUSCLES[0]);
  const [equipment, setEquipment] = useState("");
  const [error, setError] = useState("");

  const save = async () => {
    try {
      await api("/api/exercises", { method: "POST", body: JSON.stringify({ name, muscle, equipment }) });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Sheet
      title="New exercise"
      onClose={onClose}
      footer={
        <button className="btn block" onClick={save} disabled={!name.trim()}>
          Save exercise
        </button>
      }
    >
      <div className="stack">
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Muscle group">
          {MUSCLES.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Equipment (optional, e.g. Cable)"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        />
        {error && <div className="error" style={{ padding: 0 }}>{error}</div>}
      </div>
    </Sheet>
  );
}
