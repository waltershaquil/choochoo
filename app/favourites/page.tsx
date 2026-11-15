"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Workout, createWorkout, fmtSet, logTemplate, today, useLoad } from "@/lib/client";

export default function Favourites() {
  const router = useRouter();
  const { data: templates, error } = useLoad<Workout[]>("/api/workouts?kind=template");
  const [busy, setBusy] = useState(false);

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
  const create = () => run(() => createWorkout({ kind: "template", name: "", exercises: [] }));

  return (
    <>
      <div className="top">
        <div>
          <div className="sub">Saved workouts you log in one tap</div>
          <h1>Favourites</h1>
        </div>
        <button className="btn small" onClick={create} disabled={busy}>
          + New
        </button>
      </div>

      {error && <div className="glass error">{error}</div>}
      {templates && !templates.length && (
        <div className="glass card empty">
          Build a workout once — exercises, sets, weights and reps — and log it whenever you train. You can still adjust
          the numbers after logging.
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={create} disabled={busy}>
              Create your first favourite
            </button>
          </div>
        </div>
      )}

      {(templates ?? []).map((t) => (
        <div key={t.id} className="glass card wcard">
          <div className="head">
            <div>
              <div className="title">{t.name || "Untitled favourite"}</div>
              <div className="stats">
                {t.exercises.length} exercises · {t.exercises.reduce((n, x) => n + x.sets.length, 0)} sets
              </div>
            </div>
          </div>
          {t.exercises.length > 0 && (
            <div className="lines">
              {t.exercises.map((x, i) => (
                <div key={i}>
                  <span>{x.name}</span>
                  <span>
                    {x.sets.length} × {x.sets[0] ? fmtSet(x.sets[0]) : "–"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn grow" disabled={busy || !t.exercises.length} onClick={() => run(() => logTemplate(t, today()))}>
              Log today
            </button>
            <Link href={`/workout/${t.id}`} className="btn ghost">
              Edit
            </Link>
          </div>
        </div>
      ))}
    </>
  );
}
