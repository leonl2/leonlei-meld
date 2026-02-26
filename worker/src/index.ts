import { DurableObject } from "cloudflare:workers";

interface RoundEntry {
  submissions: { name: string; word: string }[];
  won: boolean;
}

interface PersistedState {
  phase: "lobby" | "playing" | "won";
  playerNames: Record<string, string>;
  playerSubmitted: Record<string, boolean>;
  usedWords: string[];
  currentSubmissions: Record<string, string>;
  roundHistory: RoundEntry[];
}

type ClientMessage =
  | { type: "join"; playerName: string }
  | { type: "start" }
  | { type: "submit"; word: string }
  | { type: "reset" }
  | { type: "ping" };

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
    return (
      (await this.ctx.storage.get<PersistedState>("state")) ?? {
        phase: "lobby",
        playerNames: {},
        playerSubmitted: {},
        usedWords: [],
        currentSubmissions: {},
        roundHistory: [],
      }
    );
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
    this.broadcast({
      type: "state",
      phase: state.phase,
      players: this.connectedIds()
        .filter((id) => state.playerNames[id] !== undefined)
        .map((id) => ({
          id,
          name: state.playerNames[id],
          submitted: state.playerSubmitted[id] ?? false,
        })),
      roundHistory: state.roundHistory,
    });
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
        const name = data.playerName.trim().slice(0, 20) || "Anonymous";
        state.playerNames[playerId] = name;
        if (state.playerSubmitted[playerId] === undefined) {
          state.playerSubmitted[playerId] = false;
        }
        await this.save(state);
        this.broadcastState(state);
        break;
      }

      case "start": {
        if (state.phase !== "lobby" || this.connectedIds().length < 2) return;
        state.phase = "playing";
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

      case "reset": {
        const ids = this.connectedIds().filter((id) => state.playerNames[id] !== undefined);
        const fresh: PersistedState = {
          phase: "playing",
          playerNames: Object.fromEntries(ids.map((id) => [id, state.playerNames[id]])),
          playerSubmitted: Object.fromEntries(ids.map((id) => [id, false])),
          usedWords: [],
          currentSubmissions: {},
          roundHistory: [],
        };
        await this.save(fresh);
        this.broadcastState(fresh);
        break;
      }
    }
  }

  private async resolveRound(state: PersistedState): Promise<void> {
    const submissions = Object.entries(state.currentSubmissions).map(([id, word]) => ({
      name: state.playerNames[id] ?? "Unknown",
      word,
    }));

    const words = submissions.map((s) => s.word);
    const won = words.length >= 2 && words.every((w) => w === words[0]);

    // Add all submitted words to usedWords now (after resolution)
    for (const word of words) {
      if (!state.usedWords.includes(word)) state.usedWords.push(word);
    }

    state.roundHistory.push({ submissions, won });

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

    const remaining = this.connectedIds();

    if (remaining.length === 0) {
      state.phase = "lobby";
      await this.save(state);
      return;
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
