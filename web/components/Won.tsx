import { RoundEntry } from "@/hooks/useGameRoom";

interface Props {
  roundHistory: RoundEntry[];
  onReset: () => void;
}

export default function Won({ roundHistory, onReset }: Props) {
  // Derive player columns from the union of all rounds, in first-appearance order.
  // This handles the case where a player left and was replaced mid-game — the
  // replacement player has a different id and would be invisible if we only
  // looked at the first round.
  // Fall back to name when id is missing (rounds persisted before the id field was added).
  const seenKeys = new Set<string>();
  const playerColumns: { id: string; name: string }[] = [];
  for (const round of roundHistory) {
    for (const sub of round.submissions) {
      const key = sub.id ?? sub.name;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        playerColumns.push({ id: sub.id, name: sub.name });
      }
    }
  }

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
              {playerColumns.map((col) => (
                <th
                  key={col.id ?? col.name}
                  className="text-left font-mono text-xs text-[var(--muted)] uppercase tracking-wider py-2 px-4"
                >
                  {col.name}
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
                {playerColumns.map((col) => {
                  // Match by id when both sides have one; fall back to name for old persisted state
                  const sub = round.submissions.find((s) =>
                    col.id && s.id ? s.id === col.id : s.name === col.name
                  );
                  // Show ✓ only on the winning word. For data persisted before
                  // winningWord was added, fall back to marking all cells in a won round.
                  const showCheck = sub !== undefined && (
                    round.winningWord !== undefined
                      ? sub.word === round.winningWord
                      : round.won
                  );
                  return (
                    <td key={col.id ?? col.name} className="py-2.5 px-4 font-mono font-semibold">
                      {sub?.word ?? "—"}
                      {showCheck && " ✓"}
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
