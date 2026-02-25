import { Player } from "@/hooks/useGameRoom";
import { useState } from "react";

interface Props {
  players: Player[];
  wins: number;
  rounds: number;
  error: string | null;
  onSubmit: (word: string) => void;
  myName: string;
}

export default function Playing({ players, wins, rounds, error, onSubmit, myName }: Props) {
  const [word, setWord] = useState("");

  const me = players.find((p) => p.name === myName);
  const hasSubmitted = me?.submitted ?? false;
  const submittedCount = players.filter((p) => p.submitted).length;

  function handleSubmit() {
    const trimmed = word.trim();
    if (!trimmed || hasSubmitted) return;
    onSubmit(trimmed);
    setWord("");
  }

  return (
    <div className="animate-fade-up space-y-8">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
          Round {rounds + 1}
        </p>
        <p className="font-mono text-xs text-[var(--muted)]">
          {wins} win{wins !== 1 ? "s" : ""}
        </p>
      </div>

      <div>
        <p className="text-sm text-[var(--muted)] mb-4">
          {submittedCount} of {players.length} submitted
        </p>
        <ul className="space-y-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 text-sm">
              <span
                className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                  p.submitted ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                }`}
              />
              <span className={p.submitted ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
                {p.name}
              </span>
              {p.submitted && (
                <span className="text-xs font-mono text-[var(--accent)]">✓</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {hasSubmitted ? (
        <div className="text-center py-6">
          <p className="text-[var(--muted)] text-sm">Word submitted — waiting for others…</p>
        </div>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Type a word…"
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
