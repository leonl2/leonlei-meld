"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [tab, setTab] = useState<"create" | "join">("create");
  const [error, setError] = useState("");

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Enter your name first."); return null; }
    sessionStorage.setItem("meld_name", trimmed);
    return trimmed;
  }

  function handleCreate() {
    if (!saveName()) return;
    router.push(`/room/${randomCode()}`);
  }

  function handleJoin() {
    if (!saveName()) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) { setError("Room code must be 4 characters."); return; }
    router.push(`/room/${code}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-10 text-center">
          <p className="font-mono text-xs text-[var(--accent)] tracking-widest uppercase mb-3">
            word convergence
          </p>
          <h1 className="text-5xl font-bold tracking-tight">Meld</h1>
          <p className="text-[var(--muted)] mt-3 text-sm leading-relaxed">
            Think the same word as your friends.<br />No hints. No timer. Just vibes.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-[var(--muted)] mb-1.5 uppercase tracking-wider">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && (tab === "create" ? handleCreate() : handleJoin())}
              placeholder="e.g. Leon"
              maxLength={20}
              className="w-full px-4 py-3 border border-[var(--border)] rounded-xl bg-white text-sm focus:outline-none focus:border-[var(--foreground)] transition-colors"
            />
          </div>

          <div className="flex rounded-xl border border-[var(--border)] overflow-hidden text-sm">
            {(["create", "join"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 font-medium transition-colors capitalize ${
                  tab === t
                    ? "bg-[var(--foreground)] text-white"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {t === "create" ? "Create room" : "Join room"}
              </button>
            ))}
          </div>

          {tab === "join" && (
            <input
              type="text"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase().slice(0, 4)); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Room code (e.g. WOLF)"
              className="w-full px-4 py-3 border border-[var(--border)] rounded-xl bg-white text-sm font-mono tracking-widest uppercase focus:outline-none focus:border-[var(--foreground)] transition-colors"
            />
          )}

          {error && (
            <p className="text-xs text-[var(--accent)] font-mono">{error}</p>
          )}

          <button
            onClick={tab === "create" ? handleCreate : handleJoin}
            className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            {tab === "create" ? "Create room" : "Join room"}
          </button>
        </div>
      </div>
    </main>
  );
}
