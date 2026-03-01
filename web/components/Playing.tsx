"use client";

import { Player, RoundEntry } from "@/hooks/useGameRoom";
import { useState, useEffect, useRef, useMemo } from "react";

interface Props {
  players: Player[];
  roundHistory: RoundEntry[];
  error: string | null;
  onSubmit: (word: string) => void;
  myId: string | null;
  restartVotes: string[];
  onRequestRestart: () => void;
  onCancelRestart: () => void;
  mySubmittedWord: string | null;
  onRetract: () => void;
}

const MAX_VISIBLE_ROWS = 5;

export default function Playing({
  players,
  roundHistory,
  error,
  onSubmit,
  myId,
  restartVotes,
  onRequestRestart,
  onCancelRestart,
  mySubmittedWord,
  onRetract,
}: Props) {
  const [word, setWord] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const prevHistoryLen = useRef(roundHistory.length);

  const me = players.find((p) => p.id === myId);
  const hasSubmitted = me?.submitted ?? false;
  const submittedCount = players.filter((p) => p.submitted).length;

  const playerColumns = useMemo(() => {
    const seen = new Set<string>();
    const cols: { id: string; name: string }[] = [];
    for (const round of roundHistory) {
      for (const sub of round.submissions) {
        if (!seen.has(sub.id)) { seen.add(sub.id); cols.push({ id: sub.id, name: sub.name }); }
      }
    }
    if (myId) {
      const idx = cols.findIndex((c) => c.id === myId);
      if (idx > 0) { const [self] = cols.splice(idx, 1); cols.unshift(self); }
    }
    return cols;
  }, [roundHistory, myId]);

  // Most recent MAX_VISIBLE_ROWS rounds; round numbers remain real (e.g. 4–8 of 8)
  const visibleHistory = roundHistory.slice(-MAX_VISIBLE_ROWS);
  const firstRoundNumber = roundHistory.length - visibleHistory.length + 1;

  const voteActive = restartVotes.length > 0;
  const iHaveVoted = myId !== null && restartVotes.includes(myId);
  const pendingPlayers = players.filter((p) => !restartVotes.includes(p.id));

  // Re-focus input and clear word when a new round starts (history grows) or
  // when the game restarts via unanimous vote (history resets to 0 while still playing).
  useEffect(() => {
    const newLen = roundHistory.length;
    const prevLen = prevHistoryLen.current;
    prevHistoryLen.current = newLen;
    if (newLen > prevLen || (newLen === 0 && prevLen > 0)) {
      setTimeout(() => {
        setWord("");
        inputRef.current?.focus();
      }, 50);
    }
  }, [roundHistory.length]);

  function handleSubmit() {
    const trimmed = word.trim();
    if (!trimmed || hasSubmitted) return;
    onSubmit(trimmed);
  }

  return (
    <div className="animate-fade-up flex flex-col">

      {/* Top section: history + status */}
      <div className="flex flex-col gap-6">

        {/* History + divider: fixed-height container so the input never shifts.
            268px = header(33) + 4 regular rows(4×41) + newest row(44) + gap-6(24) + divider(1) */}
        <div className="min-h-[268px]">
          {visibleHistory.length > 0 && (
            <div className="flex flex-col gap-6">
              <div className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left font-mono text-xs text-[var(--muted)] uppercase tracking-wider py-2 pr-4">#</th>
                      {playerColumns.map((col) => (
                        <th
                          key={col.id}
                          className="text-left font-mono text-xs text-[var(--muted)] uppercase tracking-wider py-2 px-4"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHistory.map((round, i) => {
                      const age = visibleHistory.length - 1 - i;
                      const opacity = [1, 0.45, 0.2, 0.1][Math.min(age, 3)];
                      const isNewest = age === 0;
                      return (
                        <tr
                          key={firstRoundNumber + i}
                          className={`border-b border-[var(--border)] last:border-0 ${isNewest ? "animate-pop font-bold text-base" : "font-semibold text-sm"}`}
                          style={{ opacity }}
                        >
                          <td className="py-2.5 pr-4 font-mono text-xs text-[var(--muted)]">{firstRoundNumber + i}</td>
                          {playerColumns.map((col) => {
                            const sub = round.submissions.find((s) => s.id === col.id);
                            return (
                              <td key={col.id} className="py-2.5 px-4 font-mono">
                                {sub?.word ?? "—"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[var(--border)]" />
            </div>
          )}
        </div>

        {/* Current round status */}
        <div className="flex gap-4">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5 text-sm">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                  p.submitted ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                }`}
              />
              <span className={p.submitted ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
                {p.name}
              </span>
            </div>
          ))}
          {players.length >= 2 && (
            <span className="text-xs text-[var(--muted)] ml-auto self-center">
              {submittedCount}/{players.length}
            </span>
          )}
        </div>

        {/* First-round hint — shown only before any round has completed */}
        {roundHistory.length === 0 && !hasSubmitted && (
          <p className="text-xs text-[var(--muted)]">Think of the same word as everyone else.</p>
        )}

      </div>

      {/* Bottom section: input + restart */}
      <div className="mt-8 flex flex-col gap-4">

        {/* Input */}
        {hasSubmitted ? (
          <div className="space-y-2 py-1">
            <span className="font-mono font-bold text-xl leading-none break-all">{mySubmittedWord}</span>
            <div>
              <button
                onClick={() => {
                  setWord(mySubmittedWord ?? "");
                  onRetract();
                }}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Change
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={inputRef}
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={roundHistory.length === 0 ? "Type a word…" : "Think of a common thread…"}
              autoFocus
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full px-4 py-3 border border-[var(--border)] rounded-xl bg-white text-sm focus:outline-none focus:border-[var(--foreground)] transition-colors"
            />
            {error && (
              <p className="text-xs text-[var(--accent)] font-mono">{error}</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={!word.trim()}
              className="w-full py-3 bg-[var(--foreground)] text-white font-medium rounded-xl hover:bg-[var(--accent)] transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Submit
            </button>
          </div>
        )}

        {/* Restart vote */}
        {voteActive ? (
          <div className="border border-[var(--border)] rounded-xl p-3 space-y-2.5 animate-fade-up">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--muted)]">↺</span>
              <span className="text-xs font-medium">Restart?</span>
              <div className="flex gap-2.5 ml-1">
                {players.map((p) => (
                  <span
                    key={p.id}
                    className={`flex items-center gap-1 text-xs ${
                      restartVotes.includes(p.id) ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        restartVotes.includes(p.id) ? "bg-[var(--foreground)]" : "bg-[var(--border)]"
                      }`}
                    />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
            {iHaveVoted ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--muted)]">
                  Waiting for {pendingPlayers.map((p) => p.name).join(", ")}…
                </span>
                <button
                  onClick={onCancelRestart}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={onRequestRestart}
                  className="text-xs px-3 py-1.5 bg-[var(--foreground)] text-white rounded-lg hover:bg-[var(--accent)] transition-colors"
                >
                  Agree
                </button>
                <button
                  onClick={onCancelRestart}
                  className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Nope
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onRequestRestart}
            className="self-start text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Request restart"
          >
            ↺ restart
          </button>
        )}

      </div>
    </div>
  );
}
