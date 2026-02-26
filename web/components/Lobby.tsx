import { Player } from "@/hooks/useGameRoom";
import { useState } from "react";

interface Props {
  roomCode: string;
  players: Player[];
  onStart: () => void;
}

export default function Lobby({ roomCode, players, onStart }: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/room/${roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my Meld room", url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="animate-fade-up space-y-8">
      <div>
        <p className="font-mono text-xs text-[var(--accent)] tracking-widest uppercase mb-1">
          Room code
        </p>
        <button
          onClick={share}
          className="group flex items-center gap-3"
          title="Click to share"
        >
          <span className="text-5xl font-bold tracking-widest font-mono">{roomCode}</span>
          <span className="text-xs font-mono text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors">
            {copied ? "copied!" : "share"}
          </span>
        </button>
        <p className="text-xs text-[var(--muted)] mt-2">Share this link with your friends to join.</p>
      </div>

      <div>
        <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
          Players ({players.length})
        </p>
        <ul className="space-y-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
              {p.name}
            </li>
          ))}
          {players.length < 2 && (
            <li className="text-xs text-[var(--muted)] italic">Waiting for at least one more player…</li>
          )}
        </ul>
      </div>

      <button
        onClick={onStart}
        disabled={players.length < 2}
        className="w-full py-3 bg-[var(--accent)] text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-sm disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Start game
      </button>
    </div>
  );
}
