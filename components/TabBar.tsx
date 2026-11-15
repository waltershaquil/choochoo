"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createWorkout, today } from "@/lib/client";

const TABS: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/", label: "Dashboard", icon: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /> },
  {
    href: "/diary",
    label: "Diary",
    icon: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="3" />
        <path d="M9 9h6M9 13h6M9 17h3" />
      </>
    ),
  },
  {
    href: "/exercises",
    label: "Exercises",
    icon: (
      <>
        <path d="M3 12h18" />
        <rect x="5" y="8" width="3" height="8" rx="1.2" />
        <rect x="16" y="8" width="3" height="8" rx="1.2" />
      </>
    ),
  },
  { href: "/favourites", label: "Favourites", icon: <path d="m12 4 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z" /> },
];

export default function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (path.startsWith("/workout/") || path === "/login") return null;

  const active = TABS.findIndex((t) => (t.href === "/" ? path === "/" : path.startsWith(t.href)));

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createWorkout({ kind: "workout", name: "", day: today(), finished: false, exercises: [] });
      router.push(`/workout/${id}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <nav className="tabbar">
      <div className="tabs glass">
        <span className="pill" style={{ transform: `translateX(${Math.max(active, 0) * 100}%)`, opacity: active < 0 ? 0 : 1 }} />
        {TABS.map((t, i) => (
          <Link key={t.href} href={t.href} className={i === active ? "on" : ""}>
            <svg
              viewBox="0 0 24 24"
              fill={i === active ? "currentColor" : "none"}
              fillOpacity={0.16}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {t.icon}
            </svg>
            {t.label}
          </Link>
        ))}
      </div>
      <button className="plus" onClick={start} disabled={busy} aria-label="Start a new workout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </nav>
  );
}
