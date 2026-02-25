import { RoundEntry } from "@/hooks/useGameRoom";

interface Props {
  roundHistory: RoundEntry[];
  onReset: () => void;
}

export default function Won({ roundHistory, onReset }: Props) {
  // Derive unique player names in consistent order from first round
  const playerNames = roundHistory.length > 0
    ? roundHistory[0].submissions.map((s) => s.name)
    : [];

  const rounds = roundHistory.length;

  return (
    <div className="animate-pop space-y-8">
      <div>
        <p className="font-mono text-xs text-[var(--accent)] tracking-widest uppercase mb-2">
          {rounds} round{rounds !== 1 ? "s" : ""}
        </p>
        <h2 className="text-4xl font-bold tracking-tight">Meld!</h2>
        <p className="text-[var(--muted)] text-sm mt-1">
          You found the same word. Nice sync.
        </p>
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left font-mono text-xs text-[var(--muted)] uppercase tracking-wider py-2 pr-4">
                Round
              </th>
              {playerNames.map((name) => (
                <th
                  key={name}
                  className="text-left font-mono text-xs text-[var(--muted)] uppercase tracking-wider py-2 px-4"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roundHistory.map((round, i) => (
              <tr
                key={i}
                className={`border-b border-[var(--border)] last:border-0 ${
                  round.won ? "text-[var(--accent)]" : ""
                }`}
              >
                <td className="py-2.5 pr-4 font-mono text-xs text-[var(--muted)]">
                  {i + 1}
                </td>
                {playerNames.map((name) => {
                  const sub = round.submissions.find((s) => s.name === name);
                  return (
                    <td key={name} className="py-2.5 px-4 font-mono font-semibold">
                      {sub?.word ?? "—"}
                      {round.won && " ✓"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={onReset}
        className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-sm"
      >
        Play again
      </button>
    </div>
  );
}
