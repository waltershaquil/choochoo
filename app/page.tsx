"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MUSCLES } from "@/lib/seed";
import { MUSCLE_COLORS, Workout, addDays, fmt, logTemplate, summarize, toDate, today, useLoad, weekStart } from "@/lib/client";
import { WorkoutCard } from "@/components/ui";
import VolumeChart from "@/components/VolumeChart";

export default function Dashboard() {
  const router = useRouter();
  const t = today();
  const monday = weekStart(t);
  const { data: workouts, error } = useLoad<Workout[]>(`/api/workouts?kind=workout&from=${addDays(t, -30)}`);
  const { data: templates } = useLoad<Workout[]>("/api/workouts?kind=template");
  const [busy, setBusy] = useState(0);

  const week = (workouts ?? []).filter((w) => w.day >= monday && w.day <= addDays(monday, 6));
  const s = summarize(week);
  const trained = new Set(week.filter((w) => w.exercises.length).map((w) => w.day));
  const live = (workouts ?? []).filter((w) => !w.finished);
  const scale = Math.max(20, ...Object.values(s.byMuscle));

  const log = async (tpl: Workout) => {
    setBusy(tpl.id);
    try {
      router.push(`/workout/${await logTemplate(tpl, t)}`);
    } catch (e: any) {
      alert(e.message);
      setBusy(0);
    }
  };

  return (
    <>
      <div className="top">
        <div>
          <div className="sub">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1>Dashboard</h1>
        </div>
      </div>

      {error && <div className="glass error">{error}</div>}

      <div className="glass card">
        <h2>This week</h2>
        <div className="summary">
          <div>
            <b>{trained.size}</b>
            <span>Workouts</span>
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
        <div className="week">
          {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((d) => (
            <Link key={d} href={`/diary?day=${d}`} className={`${trained.has(d) ? "on" : ""} ${d === t ? "now" : ""}`}>
              {toDate(d).toLocaleDateString(undefined, { weekday: "narrow" })}
              <i>{toDate(d).getDate()}</i>
            </Link>
          ))}
        </div>
      </div>

      {live.map((w) => (
        <WorkoutCard key={w.id} w={w} showDay />
      ))}

      <div className="glass card">
        <h2>Weekly sets per muscle</h2>
        <div className="bars">
          {MUSCLES.map((m) => {
            const n = s.byMuscle[m] ?? 0;
            return (
              <div key={m}>
                <span>{m}</span>
                <div className="track">
                  <div className="fill" style={{ width: `${(n / scale) * 100}%`, background: MUSCLE_COLORS[m] }} />
                </div>
                <span className={`n ${n ? "" : "zero"}`}>{n}</span>
              </div>
            );
          })}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Green zone marks 10–20 sets a week, the usual range for growth.
        </div>
      </div>

      <VolumeChart />

      <div className="section-title">
        <span>Quick log</span>
        <Link href="/favourites">Manage</Link>
      </div>
      {templates && !templates.length && (
        <div className="glass card empty">
          No favourites yet. Build one once, then log it with a single tap.
          <div style={{ marginTop: 12 }}>
            <Link href="/favourites" className="btn small">
              Create a favourite
            </Link>
          </div>
        </div>
      )}
      {templates && templates.length > 0 && (
        <div className="glass list" style={{ marginBottom: 14 }}>
          {templates.map((tpl) => (
            <div key={tpl.id} className="item">
              <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{tpl.name || "Untitled favourite"}</div>
                <div className="meta">
                  {tpl.exercises.length} exercises · {tpl.exercises.reduce((n, x) => n + x.sets.length, 0)} sets
                </div>
              </div>
              <button className="btn small" disabled={busy === tpl.id} onClick={() => log(tpl)}>
                Log
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="section-title">
        <span>Recent workouts</span>
        <Link href="/diary">Diary</Link>
      </div>
      {workouts && !workouts.filter((w) => w.finished).length && (
        <div className="glass card empty">Nothing logged yet. Tap + to start your first workout.</div>
      )}
      {(workouts ?? [])
        .filter((w) => w.finished)
        .slice(0, 5)
        .map((w) => (
          <WorkoutCard key={w.id} w={w} showDay />
        ))}
    </>
  );
}
