"use client";

import { useState } from "react";

export default function Login() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.href = "/";
      return;
    }
    setError(res ? "Wrong passcode." : "Could not reach the server.");
    setBusy(false);
  };

  return (
    <form onSubmit={submit} style={{ paddingTop: "22dvh" }}>
      <div className="glass card stack" style={{ padding: 22, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Choochoo</h1>
        <div className="muted" style={{ fontWeight: 600 }}>
          Enter your passcode to unlock
        </div>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="Passcode"
          aria-label="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          style={{ textAlign: "center" }}
        />
        {error && <div className="error" style={{ padding: 0, margin: "10px 0 0" }}>{error}</div>}
        <button className="btn block" disabled={busy || !passcode}>
          Unlock
        </button>
      </div>
    </form>
  );
}
