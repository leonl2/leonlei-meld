import { Player, RoundEntry } from "@/hooks/useGameRoom";

interface Props {
  roundHistory: RoundEntry[];
  myId?: string | null;
  players: Player[];
  resetVotes: string[];
  onRequestReset: () => void;
  onCancelReset: () => void;
}

export default function Won({ roundHistory, myId, players, resetVotes, onRequestReset, onCancelReset }: Props) {
  // Derive player columns from the union of all rounds, in first-appearance order.
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

  if (myId) {
    const idx = playerColumns.findIndex((c) => c.id === myId);
    if (idx > 0) { const [me] = playerColumns.splice(idx, 1); playerColumns.unshift(me); }
  }

  const rounds = roundHistory.length;
  const voteActive = resetVotes.length > 0;
  const iHaveVoted = myId != null && resetVotes.includes(myId);
  const pendingPlayers = players.filter((p) => !resetVotes.includes(p.id));

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
      <div className="overflow-hidden">
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
                  const sub = round.submissions.find((s) =>
                    col.id && s.id ? s.id === col.id : s.name === col.name
                  );
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

      {/* Play again — vote required */}
      {voteActive ? (
        <div className="border border-[var(--border)] rounded-xl p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Play again?</span>
            <div className="flex gap-2.5 ml-1">
              {players.map((p) => (
                <span
                  key={p.id}
                  className={`flex items-center gap-1 text-xs ${
                    resetVotes.includes(p.id) ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      resetVotes.includes(p.id) ? "bg-[var(--foreground)]" : "bg-[var(--border)]"
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
                onClick={onCancelReset}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onRequestReset}
                className="text-xs px-3 py-1.5 bg-[var(--foreground)] text-white rounded-lg hover:bg-[var(--accent)] transition-colors"
              >
                Agree
              </button>
              <button
                onClick={onCancelReset}
                className="text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Nope
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={onRequestReset}
          className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-sm"
        >
          Play again
        </button>
      )}
    </div>
  );
}
