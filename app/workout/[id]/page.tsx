"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Exercise,
  HistoryEntry,
  MUSCLE_COLORS,
  WSet,
  Workout,
  api,
  createWorkout,
  fmt,
  isDone,
  logTemplate,
  prettyDay,
  today,
  useLoad,
} from "@/lib/client";
import { ExerciseList, Sheet } from "@/components/ui";

/** Text-backed number field so decimals like "12.5" can be typed naturally. */
function Num({
  value,
  onChange,
  decimal,
  placeholder,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  decimal?: boolean;
  placeholder?: string;
  label: string;
}) {
  const parse = (t: string) => (t === "" || t === "." ? null : Number(t));
  const [txt, setTxt] = useState(value == null ? "" : String(value));
  useEffect(() => {
    setTxt((cur) => (parse(cur) === value ? cur : value == null ? "" : String(value)));
  }, [value]);
  return (
    <input
      inputMode={decimal ? "decimal" : "numeric"}
      value={txt}
      placeholder={placeholder}
      aria-label={label}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        if (!(decimal ? /^\d{0,4}(\.\d{0,2})?$/ : /^\d{0,3}$/).test(t)) return;
        setTxt(t);
        onChange(parse(t));
      }}
    />
  );
}

export default function WorkoutEditor() {
  const id = Number(useParams<{ id: string }>().id);
  const router = useRouter();

  const [w, setW] = useState<Workout | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"" | "saving" | "saved" | "error">("");
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [last, setLast] = useState<Record<number, WSet[]>>({});
  const { data: library } = useLoad<Exercise[]>(picking ? "/api/exercises" : null);

  const latest = useRef<Workout | null>(null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const asked = useRef(new Set<number>());

  useEffect(() => {
    api<Workout>(`/api/workouts/${id}`)
      .then((d) => {
        latest.current = d;
        setW(d);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // Saves are queued so two writes can never overlap.
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    chain.current = chain.current.then(async () => {
      if (!dirty.current || !latest.current) return;
      dirty.current = false;
      setStatus("saving");
      try {
        await api(`/api/workouts/${id}`, { method: "PUT", body: JSON.stringify(latest.current) });
        setStatus(dirty.current ? "saving" : "saved");
      } catch {
        dirty.current = true;
        setStatus("error");
      }
    });
    return chain.current;
  }, [id]);

  const change = useCallback(
    (fn: (w: Workout) => Workout) => {
      if (!latest.current) return;
      const next = fn(latest.current);
      latest.current = next;
      dirty.current = true;
      setW(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
    },
    [flush]
  );

  // Leaving the page with unsaved edits: send them on the way out.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current && latest.current) {
        fetch(`/api/workouts/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(latest.current),
          keepalive: true,
        });
      }
    },
    [id]
  );

  // "Last time" numbers for each exercise in a workout.
  useEffect(() => {
    if (!w || w.kind !== "workout") return;
    for (const x of w.exercises) {
      if (asked.current.has(x.exercise_id)) continue;
      asked.current.add(x.exercise_id);
      api<{ history: HistoryEntry[] }>(`/api/exercises/${x.exercise_id}?exclude=${id}`)
        .then((d) => d.history[0] && setLast((l) => ({ ...l, [x.exercise_id]: d.history[0].sets })))
        .catch(() => {});
    }
  }, [w, id]);

  if (error) return <div className="glass error">{error}</div>;
  if (!w) return <div className="empty">Loading…</div>;

  const isTemplate = w.kind === "template";
  const setEx = (i: number, fn: (sets: WSet[]) => WSet[]) =>
    change((cur) => ({ ...cur, exercises: cur.exercises.map((x, k) => (k === i ? { ...x, sets: fn(x.sets) } : x)) }));

  const leave = async (to?: string) => {
    if (!w.exercises.length && !w.name.trim()) {
      dirty.current = false;
      await api(`/api/workouts/${id}`, { method: "DELETE" }).catch(() => {});
    } else {
      await flush();
    }
    router.push(to ?? (isTemplate ? "/favourites" : `/diary?day=${latest.current?.day || today()}`));
  };

  const remove = async () => {
    if (!confirm(isTemplate ? "Delete this favourite?" : "Delete this workout?")) return;
    dirty.current = false;
    try {
      await api(`/api/workouts/${id}`, { method: "DELETE" });
      router.push(isTemplate ? "/favourites" : `/diary?day=${w.day}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const addPicked = () => {
    const chosen = (library ?? []).filter((e) => picked.has(e.id));
    change((cur) => ({
      ...cur,
      exercises: [
        ...cur.exercises,
        ...chosen.map((e) => ({
          exercise_id: e.id,
          name: e.name,
          muscle: e.muscle,
          sets: Array.from({ length: 3 }, () => ({ weight: null, reps: null })),
        })),
      ],
    }));
    setPicked(new Set());
    setPicking(false);
  };

  const saveAsFavourite = async () => {
    try {
      await flush();
      await createWorkout({ ...latest.current!, kind: "template", name: w.name || "My workout", day: "" });
      alert("Saved to Favourites.");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const logToday = async () => {
    try {
      await flush();
      router.push(`/workout/${await logTemplate(latest.current!, today())}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const doneSets = w.exercises.reduce((n, x) => n + x.sets.filter(isDone).length, 0);

  return (
    <>
      <div className="top">
        <button className="icon-btn" onClick={() => leave()} aria-label="Back">
          ‹
        </button>
        <div style={{ flex: 1 }}>
          <div className="sub">
            {isTemplate ? "Favourite" : w.finished ? `Completed · ${prettyDay(w.day)}` : `In progress · ${prettyDay(w.day)}`}
          </div>
        </div>
        <span className={`status ${status === "error" ? "error" : ""}`}>
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved ✓"}
          {status === "error" && (
            <button className="link" style={{ color: "inherit" }} onClick={flush}>
              Not saved — retry
            </button>
          )}
        </span>
      </div>

      <div className="glass card stack">
        <input
          className="input"
          style={{ fontWeight: 750, fontSize: 18 }}
          placeholder={isTemplate ? "Favourite name (e.g. Push day)" : "Workout name (e.g. Push day)"}
          value={w.name}
          onChange={(e) => change((cur) => ({ ...cur, name: e.target.value }))}
        />
        {!isTemplate && (
          <div className="row">
            <input
              className="input"
              type="date"
              value={w.day}
              aria-label="Workout date"
              onChange={(e) => e.target.value && change((cur) => ({ ...cur, day: e.target.value }))}
            />
            <span className="tag">{doneSets} sets</span>
          </div>
        )}
      </div>

      {!w.exercises.length && (
        <div className="glass card empty">
          {isTemplate ? "Add the exercises, sets, weights and reps you usually do." : "Add your first exercise to start logging sets."}
        </div>
      )}

      {w.exercises.map((x, i) => {
        const prev = last[x.exercise_id];
        return (
          <div key={`${i}-${x.exercise_id}`} className="glass card">
            <div className="ex-head">
              <span className="dot" style={{ background: MUSCLE_COLORS[x.muscle], marginRight: 0 }} />
              <div className="name">
                {x.name}
                <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                  {x.muscle}
                </div>
              </div>
              <button
                className="x"
                aria-label={`Remove ${x.name}`}
                onClick={() => {
                  if (x.sets.some(isDone) && !confirm(`Remove ${x.name} and its sets?`)) return;
                  change((cur) => ({ ...cur, exercises: cur.exercises.filter((_, k) => k !== i) }));
                }}
              >
                ×
              </button>
            </div>

            <table className="sets">
              <thead>
                <tr>
                  <th>Set</th>
                  {!isTemplate && <th>Last</th>}
                  <th>kg</th>
                  <th>Reps</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {x.sets.map((s, j) => {
                  const p = prev?.[j] ?? prev?.[prev.length - 1];
                  return (
                    <tr key={j} className={isDone(s) ? "done" : ""}>
                      <td className="idx">{j + 1}</td>
                      {!isTemplate && <td className="last">{p ? `${p.weight ? fmt(p.weight) : "–"} × ${p.reps}` : "–"}</td>}
                      <td>
                        <Num
                          decimal
                          label={`${x.name} set ${j + 1} weight`}
                          value={s.weight}
                          placeholder={p?.weight ? String(p.weight) : "0"}
                          onChange={(v) => setEx(i, (sets) => sets.map((t, k) => (k === j ? { ...t, weight: v } : t)))}
                        />
                      </td>
                      <td>
                        <Num
                          label={`${x.name} set ${j + 1} reps`}
                          value={s.reps}
                          placeholder={p?.reps ? String(p.reps) : "0"}
                          onChange={(v) => setEx(i, (sets) => sets.map((t, k) => (k === j ? { ...t, reps: v } : t)))}
                        />
                      </td>
                      <td style={{ width: 30 }}>
                        <button
                          className="x"
                          aria-label={`Delete set ${j + 1}`}
                          onClick={() => setEx(i, (sets) => sets.filter((_, k) => k !== j))}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <button
              className="btn ghost small block"
              style={{ marginTop: 8 }}
              onClick={() => setEx(i, (sets) => [...sets, { ...(sets[sets.length - 1] ?? { weight: null, reps: null }) }])}
            >
              + Add set
            </button>
          </div>
        );
      })}

      <div className="stack" style={{ marginTop: 4 }}>
        <button className="btn ghost block" onClick={() => setPicking(true)}>
          + Add exercise
        </button>

        {!isTemplate && !w.finished && (
          <button
            className="btn block"
            disabled={!w.exercises.length}
            onClick={async () => {
              change((cur) => ({ ...cur, finished: true }));
              await leave();
            }}
          >
            Finish workout
          </button>
        )}
        {!isTemplate && w.finished && (
          <button className="btn block" onClick={() => leave()}>
            Done
          </button>
        )}
        {isTemplate && (
          <button className="btn block" disabled={!w.exercises.length} onClick={logToday}>
            Log this today
          </button>
        )}

        <div className="row">
          {!isTemplate && (
            <button className="btn ghost grow" disabled={!w.exercises.length} onClick={saveAsFavourite}>
              ★ Save as favourite
            </button>
          )}
          <button className="btn danger grow" onClick={remove}>
            Delete {isTemplate ? "favourite" : "workout"}
          </button>
        </div>
      </div>

      {picking && (
        <Sheet
          title="Add exercises"
          onClose={() => setPicking(false)}
          footer={
            <button className="btn block" disabled={!picked.size} onClick={addPicked}>
              {picked.size ? `Add ${picked.size} exercise${picked.size === 1 ? "" : "s"}` : "Select exercises"}
            </button>
          }
        >
          {!library && <div className="empty">Loading…</div>}
          {library && (
            <ExerciseList
              exercises={library}
              selected={picked}
              onTap={(e) =>
                setPicked((cur) => {
                  const next = new Set(cur);
                  next.has(e.id) ? next.delete(e.id) : next.add(e.id);
                  return next;
                })
              }
            />
          )}
        </Sheet>
      )}
    </>
  );
}
