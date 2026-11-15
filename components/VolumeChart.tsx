"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MUSCLES } from "@/lib/seed";
import { addDays, fmt, toDate, today, useLoad, weekStart } from "@/lib/client";

type Row = { day: string; muscle: string; volume: number; sets: number };

const WEEKS = 12;
const H = 190;
const PAD = { top: 12, right: 14, bottom: 26, left: 40 };

const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n)));
const shortDate = (day: string) => toDate(day).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Rounds the axis maximum up to a clean number so gridlines land on readable values. */
function niceMax(v: number) {
  if (v <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(v));
  return [1, 1.5, 2, 3, 4, 5, 6, 8, 10].map((m) => m * pow).find((m) => m >= v) ?? 10 * pow;
}

export default function VolumeChart() {
  const first = addDays(weekStart(today()), -7 * (WEEKS - 1));
  const { data } = useLoad<Row[]>(`/api/progress?from=${first}`);
  const [muscle, setMuscle] = useState("All");
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(330);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const weeks = useMemo(() => {
    const out = Array.from({ length: WEEKS }, (_, i) => ({ start: addDays(first, i * 7), volume: 0, sets: 0 }));
    for (const r of data ?? []) {
      if (muscle !== "All" && r.muscle !== muscle) continue;
      const i = Math.round((toDate(weekStart(r.day)).getTime() - toDate(first).getTime()) / (7 * 864e5));
      if (out[i]) {
        out[i].volume += Number(r.volume) || 0;
        out[i].sets += r.sets;
      }
    }
    return out;
  }, [data, muscle, first]);

  const max = niceMax(Math.max(...weeks.map((w) => w.volume)));
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (WEEKS - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const path = weeks.map((w, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(w.volume).toFixed(1)}`).join(" ");

  const shown = hover ?? WEEKS - 1;
  const cur = weeks[shown];
  const prev = weeks[shown - 1];
  const delta = prev && prev.volume > 0 ? Math.round(((cur.volume - prev.volume) / prev.volume) * 100) : null;
  const empty = !!data && weeks.every((w) => w.sets === 0);

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - PAD.left) / innerW) * (WEEKS - 1));
    setHover(Math.min(WEEKS - 1, Math.max(0, i)));
  };

  return (
    <div className="glass card">
      <h2>Volume per week</h2>
      <div className="chips">
        {["All", ...MUSCLES].map((m) => (
          <button key={m} className={`chip ${muscle === m ? "on" : ""}`} onClick={() => setMuscle(m)}>
            {m}
          </button>
        ))}
      </div>

      <div className="chart-readout">
        <div>
          <b>{fmt(Math.round(cur.volume))}</b> kg
        </div>
        <div className="muted">
          {shown === WEEKS - 1 ? "This week" : `Week of ${shortDate(cur.start)}`} · {cur.sets} sets
          {delta !== null && ` · ${delta > 0 ? "+" : ""}${delta}% vs week before`}
        </div>
      </div>

      <div ref={box} style={{ position: "relative" }}>
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Weekly training volume for ${muscle === "All" ? "all muscles" : muscle}, last ${WEEKS} weeks`}
          style={{ display: "block", touchAction: "pan-y", cursor: "crosshair" }}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(max * t)} y2={y(max * t)} className="chart-grid" />
              <text x={PAD.left - 8} y={y(max * t) + 4} textAnchor="end" className="chart-label">
                {compact(max * t)}
              </text>
            </g>
          ))}
          {weeks.map(
            (w, i) =>
              (WEEKS - 1 - i) % 3 === 0 && (
                <text key={w.start} x={x(i)} y={H - 6} textAnchor={i === WEEKS - 1 ? "end" : "middle"} className="chart-label">
                  {shortDate(w.start)}
                </text>
              )
          )}
          {!empty && (
            <>
              <line x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={PAD.top + innerH} className="chart-cross" />
              <path key={muscle} d={path} pathLength={1} className="chart-line" />
              {weeks.map((w, i) => (
                <circle key={w.start} cx={x(i)} cy={y(w.volume)} r={i === shown ? 5 : 3} className="chart-dot" />
              ))}
            </>
          )}
        </svg>
        {empty && (
          <div className="chart-empty muted">
            {muscle === "All" ? "Log workouts to see your weekly volume." : `No ${muscle.toLowerCase()} sets in the last ${WEEKS} weeks.`}
          </div>
        )}
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        Volume = weight × reps, summed over every logged set. Weeks start on Monday.
      </div>
    </div>
  );
}
