import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, tokenFor } from "@/lib/auth";

// When APP_PASSCODE is set, every page and API route needs the unlock cookie.
// Without it (e.g. local dev) the app stays open.
export async function proxy(req: NextRequest) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // The cron endpoint has its own CRON_SECRET check and only returns counts.
  if (pathname === "/login" || pathname === "/api/login" || pathname === "/api/keepalive") return NextResponse.next();
  if (req.cookies.get(AUTH_COOKIE)?.value === (await tokenFor(passcode))) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Locked" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/((?!_next/|icon.svg|favicon.ico).*)"] };
