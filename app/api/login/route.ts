import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, tokenFor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) return NextResponse.json({ ok: true });

  const body = await req.json().catch(() => ({}));
  const [given, expected] = await Promise.all([tokenFor(String(body?.passcode ?? "")), tokenFor(passcode)]);
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    await new Promise((r) => setTimeout(r, 800)); // slows down guessing
    return NextResponse.json({ error: "Wrong passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

// Lock this device again.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
