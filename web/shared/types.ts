// Wire-format types shared between the worker (server) and the web (client).
// Both projects import from this file via the @shared/types path alias.
// Only types that cross the WebSocket boundary belong here — server-internal
// state (PersistedState) and client-only state (GameState) stay local.

/** Game phases known to the server. The client adds "connecting" locally. */
export type ServerPhase = "lobby" | "playing" | "won";

export type WinCondition = "exact" | "majority";

export interface GameConfig {
  winCondition: WinCondition;
}

export const DEFAULT_CONFIG: GameConfig = {
  winCondition: "exact",
};

export interface RoundEntry {
  submissions: { id: string; name: string; word: string }[];
  won: boolean;
  /**
   * The word that clinched the round; null when the round was not won.
   * Absent on data persisted before this field was added — treat as null.
   */
  winningWord?: string | null;
}

export interface Player {
  id: string;
  name: string;
  submitted: boolean;
}

export type ClientMessage =
  | { type: "join"; playerName: string }
  | { type: "start"; winCondition?: WinCondition }
  | { type: "submit"; word: string }
  | { type: "retract" }
  | { type: "reset" }
  | { type: "restart_request" }
  | { type: "restart_cancel" }
  | { type: "ping" };

export interface ServerStateMessage {
  type: "state";
  phase: ServerPhase;
  players: Player[];
  roundHistory: RoundEntry[];
  restartVotes: string[];
  config: GameConfig;
}
