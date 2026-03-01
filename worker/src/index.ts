import { DurableObject } from "cloudflare:workers";
import type { RoundEntry, Player, ClientMessage, GameConfig, ServerStateMessage } from "@shared/types";
import { DEFAULT_CONFIG } from "@shared/types";

interface PersistedState {
  phase: "lobby" | "playing" | "won";
  playerNames: Record<string, string>;
  playerSubmitted: Record<string, boolean>;
  usedWords: string[];
  currentSubmissions: Record<string, string>;
  roundHistory: RoundEntry[];
  restartVotes: string[];
  config: GameConfig;
}

/** Returns the winning word if the submission set satisfies the win condition, otherwise null. */
function resolveWin(words: string[], config: GameConfig): string | null {
  if (words.length < 2) return null;
  if (config.winCondition === "exact") {
    return words.every((w) => w === words[0]) ? words[0] : null;
  }
  // majority: more than half of submissions are the same word
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  let winner: string | null = null;
  let maxCount = 0;
  for (const [word, count] of counts) {
    if (count > maxCount) { maxCount = count; winner = word; }
  }
  return maxCount > words.length / 2 ? winner : null;
}

export class GameRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [crypto.randomUUID()]);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async load(): Promise<PersistedState> {
    const saved = await this.ctx.storage.get<PersistedState>("state");
    if (!saved) {
      return {
        phase: "lobby",
        playerNames: {},
        playerSubmitted: {},
        usedWords: [],
        currentSubmissions: {},
        roundHistory: [],
        restartVotes: [],
        config: { ...DEFAULT_CONFIG },
      };
    }
    // Migrate old persisted state that pre-dates the restartVotes / config fields
    return { ...saved, restartVotes: saved.restartVotes ?? [], config: saved.config ?? { ...DEFAULT_CONFIG } };
  }

  private async save(state: PersistedState): Promise<void> {
    await this.ctx.storage.put("state", state);
  }

  private connectedIds(): string[] {
    return this.ctx.getWebSockets().map((ws) => this.ctx.getTags(ws)[0]);
  }

  private broadcast(message: object): void {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(data); } catch { /* closed */ }
    }
  }

  private broadcastState(state: PersistedState): void {
    const message: ServerStateMessage = {
      type: "state",
      phase: state.phase,
      players: this.connectedIds()
        .filter((id) => state.playerNames[id] !== undefined)
        .map((id): Player => ({
          id,
          name: state.playerNames[id],
          submitted: state.playerSubmitted[id] ?? false,
        })),
      roundHistory: state.roundHistory,
      restartVotes: state.restartVotes,
      config: state.config,
    };
    this.broadcast(message);
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const playerId = this.ctx.getTags(ws)[0];
    let data: ClientMessage;
    try { data = JSON.parse(message as string); } catch { return; }

    if (data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
      return;
    }

    const state = await this.load();

    switch (data.type) {
      case "join": {
        let name = data.playerName.trim().slice(0, 20) || "Anonymous";
        const takenNames = new Set(
          this.connectedIds()
            .filter((id) => id !== playerId)
            .map((id) => state.playerNames[id])
            .filter(Boolean)
        );
        if (takenNames.has(name)) {
          let n = 2;
          while (takenNames.has(`${name} (${n})`)) n++;
          name = `${name} (${n})`;
        }
        state.playerNames[playerId] = name;
        if (state.playerSubmitted[playerId] === undefined) {
          state.playerSubmitted[playerId] = false;
        }
        await this.save(state);
        ws.send(JSON.stringify({ type: "welcome", playerId }));
        this.broadcastState(state);
        break;
      }

      case "start": {
        if (state.phase !== "lobby" || this.connectedIds().length < 2) return;
        state.phase = "playing";
        if (data.winCondition) state.config = { winCondition: data.winCondition };
        state.currentSubmissions = {};
        for (const id of this.connectedIds()) state.playerSubmitted[id] = false;
        await this.save(state);
        this.broadcastState(state);
        break;
      }

      case "submit": {
        if (state.phase !== "playing" || state.playerSubmitted[playerId]) return;
        const word = data.word.trim().toLowerCase();
        if (!word) return;

        // Only reject words used in PREVIOUS rounds — same word by multiple
        // players in the same round is how you win
        if (state.usedWords.includes(word)) {
          ws.send(JSON.stringify({ type: "error", message: `"${word}" was used in a previous round.` }));
          return;
        }

        state.playerSubmitted[playerId] = true;
        state.currentSubmissions[playerId] = word;
        await this.save(state);

        const ids = this.connectedIds();
        const allSubmitted = ids.every((id) => state.playerSubmitted[id]);
        if (allSubmitted) {
          await this.resolveRound(state);
        } else {
          this.broadcastState(state);
        }
        break;
      }

      case "retract": {
        if (state.phase !== "playing" || !state.playerSubmitted[playerId]) return;
        delete state.currentSubmissions[playerId];
        state.playerSubmitted[playerId] = false;
        await this.save(state);
        this.broadcastState(state);
        break;
      }

      case "restart_request": {
        if (state.phase !== "playing") break;
        if (!state.restartVotes.includes(playerId)) {
          state.restartVotes.push(playerId);
        }
        const namedPlayers = this.connectedIds().filter((id) => state.playerNames[id] !== undefined);
        if (namedPlayers.length > 0 && namedPlayers.every((id) => state.restartVotes.includes(id))) {
          const fresh: PersistedState = {
            phase: "playing",
            playerNames: Object.fromEntries(namedPlayers.map((id) => [id, state.playerNames[id]])),
            playerSubmitted: Object.fromEntries(namedPlayers.map((id) => [id, false])),
            usedWords: [],
            currentSubmissions: {},
            roundHistory: [],
            restartVotes: [],
            config: state.config,
          };
          await this.save(fresh);
          this.broadcastState(fresh);
        } else {
          await this.save(state);
          this.broadcastState(state);
        }
        break;
      }

      case "restart_cancel": {
        if (state.phase !== "playing") break;
        state.restartVotes = [];
        await this.save(state);
        this.broadcastState(state);
        break;
      }

      case "reset": {
        const ids = this.connectedIds().filter((id) => state.playerNames[id] !== undefined);
        const fresh: PersistedState = {
          phase: "playing",
          playerNames: Object.fromEntries(ids.map((id) => [id, state.playerNames[id]])),
          playerSubmitted: Object.fromEntries(ids.map((id) => [id, false])),
          usedWords: [],
          currentSubmissions: {},
          roundHistory: [],
          restartVotes: [],
          config: state.config,
        };
        await this.save(fresh);
        this.broadcastState(fresh);
        break;
      }
    }
  }

  private async resolveRound(state: PersistedState): Promise<void> {
    const submissions = Object.entries(state.currentSubmissions).map(([id, word]) => ({
      id,
      name: state.playerNames[id] ?? "Unknown",
      word,
    }));

    const words = submissions.map((s) => s.word);
    const winningWord = resolveWin(words, state.config);
    const won = winningWord !== null;

    // Add all submitted words to usedWords now (after resolution)
    for (const word of words) {
      if (!state.usedWords.includes(word)) state.usedWords.push(word);
    }

    state.roundHistory.push({ submissions, won, winningWord });

    if (won) {
      state.phase = "won";
    } else {
      // Auto-advance to next round
      state.phase = "playing";
      state.currentSubmissions = {};
      for (const id of this.connectedIds()) state.playerSubmitted[id] = false;
    }

    await this.save(state);
    this.broadcastState(state);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const playerId = this.ctx.getTags(ws)[0];
    const state = await this.load();

    delete state.playerNames[playerId];
    delete state.playerSubmitted[playerId];
    delete state.currentSubmissions[playerId];
    // Remove from restart vote if they had voted
    state.restartVotes = state.restartVotes.filter((id) => id !== playerId);

    const remaining = this.connectedIds();

    if (remaining.length === 0) {
      state.phase = "lobby";
      state.restartVotes = [];
      await this.save(state);
      return;
    }

    // If a restart vote was in progress, check if the remaining players have now all agreed
    if (state.phase === "playing" && state.restartVotes.length > 0) {
      const namedRemaining = remaining.filter((id) => state.playerNames[id] !== undefined);
      if (namedRemaining.length > 0 && namedRemaining.every((id) => state.restartVotes.includes(id))) {
        const fresh: PersistedState = {
          phase: "playing",
          playerNames: Object.fromEntries(namedRemaining.map((id) => [id, state.playerNames[id]])),
          playerSubmitted: Object.fromEntries(namedRemaining.map((id) => [id, false])),
          usedWords: [],
          currentSubmissions: {},
          roundHistory: [],
          restartVotes: [],
          config: state.config,
        };
        await this.save(fresh);
        this.broadcastState(fresh);
        return;
      }
    }

    if (state.phase === "playing" && remaining.length > 0) {
      const allDone = remaining.every((id) => state.playerSubmitted[id]);
      if (allDone && Object.keys(state.currentSubmissions).length > 0) {
        await this.save(state);
        await this.resolveRound(state);
        return;
      }
    }

    await this.save(state);
    this.broadcastState(state);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }
}

interface Env {
  GAME_ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Upgrade",
        },
      });
    }
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/room\/([A-Z0-9]{4})\/ws$/);
    if (match) {
      const id = env.GAME_ROOM.idFromName(match[1]);
      return env.GAME_ROOM.get(id).fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
