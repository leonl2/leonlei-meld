"use client";

import { Player, RoundEntry } from "@/hooks/useGameRoom";
import { useState, useEffect, useRef } from "react";

interface Props {
  players: Player[];
  roundHistory: RoundEntry[];
  error: string | null;
  onSubmit: (word: string) => void;
  myName: string;
}

const HISTORY_VISIBLE = 4;

const opacities = [1, 0.45, 0.2, 0.1];
const sizes    = ["text-base", "text-sm", "text-xs", "text-xs"];

export default function Playing({ players, roundHistory, error, onSubmit, myName }: Props) {
  const [word, setWord] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const prevHistoryLen = useRef(roundHistory.length);

  const me = players.find((p) => p.name === myName);
  const hasSubmitted = me?.submitted ?? false;
  const submittedCount = players.filter((p) => p.submitted).length;

  // Re-focus input and clear word when a new round starts (history length increases)
  useEffect(() => {
    if (roundHistory.length > prevHistoryLen.current) {
      prevHistoryLen.current = roundHistory.length;
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
        <div className="space-y-2">
          {visibleHistory.map((round, i) => (
            <div
              key={roundHistory.length - i}
              className={`transition-all duration-500 ${sizes[i]} ${i === 0 ? "animate-pop" : ""}`}
              style={{ opacity: opacities[i] }}
            >
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {round.submissions.map((s) => (
                  <span key={s.name}>
                    <span className="font-mono font-semibold">{s.word}</span>
                    {i === 0 && (
                      <span className="text-[var(--muted)] ml-1">({s.name})</span>
                    )}
                  </span>
                ))}
              </div>
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

      {/* Input */}
      {hasSubmitted ? (
        <p className="text-sm text-[var(--muted)] py-2">Waiting for others…</p>
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
    </div>
  );
}
