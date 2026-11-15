"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createWorkout, today } from "@/lib/client";

const icons: Record<string, React.ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  diary: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2.5" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  exercises: (
    <>
      <path d="M3 12h18" />
      <rect x="5" y="8" width="3" height="8" rx="1" />
      <rect x="16" y="8" width="3" height="8" rx="1" />
    </>
  ),
  star: <path d="m12 4 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z" />,
};

const Tab = ({ href, icon, label, path }: { href: string; icon: string; label: string; path: string }) => (
  <Link href={href} className={(href === "/" ? path === "/" : path.startsWith(href)) ? "on" : ""}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {icons[icon]}
    </svg>
    {label}
  </Link>
);

export default function TabBar() {
  const path = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (path.startsWith("/workout/") || path === "/login") return null;

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
    <nav className="tabbar glass">
      <Tab href="/" icon="home" label="Dashboard" path={path} />
      <Tab href="/diary" icon="diary" label="Diary" path={path} />
      <button className="plus" onClick={start} disabled={busy} aria-label="Start a new workout">
        +
      </button>
      <Tab href="/exercises" icon="exercises" label="Exercises" path={path} />
      <Tab href="/favourites" icon="star" label="Favourites" path={path} />
    </nav>
  );
}
