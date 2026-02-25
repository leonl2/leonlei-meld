import { Submission } from "@/hooks/useGameRoom";

interface Props {
  submissions: Submission[];
  won: boolean;
  wins: number;
  rounds: number;
  onNextRound: () => void;
  onReset: () => void;
}

export default function Reveal({ submissions, won, wins, rounds, onNextRound, onReset }: Props) {
  return (
    <div className="animate-pop space-y-8">
      <div>
        <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2">
          Round {rounds} result
        </p>
        <h2 className={`text-4xl font-bold tracking-tight ${won ? "text-[var(--accent)]" : ""}`}>
          {won ? "Meld!" : "Not quite."}
        </h2>
        <p className="text-[var(--muted)] text-sm mt-1">
          {won
            ? "You thought the same word. Perfect sync."
            : "Different words. Use them as hints for next round."}
        </p>
      </div>

      <div>
        <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
          Words submitted
        </p>
        <ul className="space-y-2">
          {submissions.map((s, i) => (
            <li key={i} className="flex items-baseline justify-between text-sm border-b border-[var(--border)] pb-2 last:border-0">
              <span className="text-[var(--muted)]">{s.name}</span>
              <span className="font-mono font-semibold">{s.word}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)]">
        <span>{wins} win{wins !== 1 ? "s" : ""} / {rounds} round{rounds !== 1 ? "s" : ""}</span>
        <button
          onClick={onReset}
          className="hover:text-[var(--accent)] transition-colors underline underline-offset-2"
        >
          Reset
        </button>
      </div>

      <button
        onClick={onNextRound}
        className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-sm"
      >
        Next round →
      </button>
    </div>
  );
}
