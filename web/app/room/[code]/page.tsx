"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameRoom } from "@/hooks/useGameRoom";
import Lobby from "@/components/Lobby";
import Playing from "@/components/Playing";
import Won from "@/components/Won";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [playerName, setPlayerName] = useState(
    () => sessionStorage.getItem("meld_name") ?? ""
  );
  const [nameInput, setNameInput] = useState("");
  const [nameSet, setNameSet] = useState(
    () => !!sessionStorage.getItem("meld_name")
  );

  const { state, error, connected, myId, mySubmittedWord, start, submit, retract, requestReset, cancelReset, requestRestart, cancelRestart } = useGameRoom(code, playerName);

  function confirmName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    sessionStorage.setItem("meld_name", trimmed);
    setPlayerName(trimmed);
    setNameSet(true);
  }

  if (!nameSet) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm animate-fade-up space-y-4">
          <h2 className="text-2xl font-bold">
            Join room <span className="font-mono text-[var(--accent)]">{code}</span>
          </h2>
          <p className="text-sm text-[var(--muted)]">Think of the same word as everyone else — no hints, no clues.</p>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmName()}
            placeholder="Your name"
            autoFocus
            maxLength={20}
            className="w-full px-4 py-3 border border-[var(--border)] rounded-xl bg-white text-sm focus:outline-none focus:border-[var(--foreground)] transition-colors"
          />
          <button
            onClick={confirmName}
            className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-sm"
          >
            Join
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            ← Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-10 max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-10">
        <button
          onClick={() => router.push("/")}
          className="text-xs font-mono text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          ← leave
        </button>
        <span className={`text-xs font-mono ${connected ? "text-green-500" : "text-[var(--muted)]"}`}>
          {connected ? code : "connecting…"}
        </span>
      </div>

      {state.phase === "connecting" && (
        <p className="text-[var(--muted)] text-sm animate-fade-up">Connecting…</p>
      )}

      {state.phase === "lobby" && (
        <Lobby roomCode={code} players={state.players} onStart={start} />
      )}

      {state.phase === "playing" && (
        <Playing
          players={state.players}
          roundHistory={state.roundHistory}
          error={error}
          onSubmit={submit}
          myId={myId}
          restartVotes={state.restartVotes}
          onRequestRestart={requestRestart}
          onCancelRestart={cancelRestart}
          mySubmittedWord={mySubmittedWord}
          onRetract={retract}
        />
      )}

      {state.phase === "won" && (
        <Won
          roundHistory={state.roundHistory}
          myId={myId}
          players={state.players}
          resetVotes={state.restartVotes}
          onRequestReset={requestReset}
          onCancelReset={cancelReset}
        />
      )}
    </main>
  );
}
