"use client";

import { Player, RoundEntry } from "@/hooks/useGameRoom";
import { useState, useEffect, useRef } from "react";

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

const HISTORY_VISIBLE = 4;
const opacities = [1, 0.35, 0.15, 0.07];
const sizes = ["", "text-sm", "text-xs", "text-xs"];

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

  // Most recent round first
  const visibleHistory = [...roundHistory].reverse().slice(0, HISTORY_VISIBLE);

  return (
    <div className="animate-fade-up flex flex-col gap-6">

      {/* Word history waterfall */}
      {visibleHistory.length > 0 && (
        <div className="space-y-3">
          {visibleHistory.map((round, i) => (
            <div
              key={roundHistory.length - i}
              className={`transition-all duration-500 ${sizes[i]} ${i === 0 ? "animate-pop" : ""}`}
              style={{ opacity: opacities[i] }}
            >
              {i === 0 ? (
                /* Most recent round: large words with names clearly labelled below.
                   Border separator between submissions stops long words from merging visually. */
                <div className="flex flex-wrap gap-y-2">
                  {round.submissions.map((s, j) => (
                    <div
                      key={s.id}
                      className={`flex flex-col gap-0.5 ${j > 0 ? "border-l border-[var(--border)] pl-5 ml-5" : ""}`}
                    >
                      <span className="font-mono font-bold text-xl leading-none break-all">{s.word}</span>
                      <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
                        {s.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                /* Older rounds: compact words only, no names */
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {round.submissions.map((s) => (
                    <span key={s.id} className="font-mono font-semibold">{s.word}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Divider when there's history */}
      {visibleHistory.length > 0 && (
        <div className="border-t border-[var(--border)]" />
      )}

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
          className="self-start text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mt-1"
          aria-label="Request restart"
        >
          ↺ restart
        </button>
      )}
    </div>
  );
}
