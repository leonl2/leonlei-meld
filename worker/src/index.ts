import { DurableObject } from "cloudflare:workers";

interface Player {
  name: string;
  submitted: boolean;
}

type Phase = "lobby" | "playing" | "reveal";

type ClientMessage =
  | { type: "join"; playerName: string }
  | { type: "start" }
  | { type: "submit"; word: string }
  | { type: "nextRound" }
  | { type: "reset" };

export class GameRoom extends DurableObject {
  private players: Map<string, Player> = new Map();
  private phase: Phase = "lobby";
  private usedWords: Set<string> = new Set();
  private currentSubmissions: Map<string, string> = new Map();
  private wins = 0;
  private rounds = 0;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const playerId = crypto.randomUUID();
    this.ctx.acceptWebSocket(server, [playerId]);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const playerId = this.ctx.getTags(ws)[0];

    let data: ClientMessage;
    try {
      data = JSON.parse(message as string);
    } catch {
      return;
    }

    switch (data.type) {
      case "join": {
        const name = data.playerName.trim().slice(0, 20) || "Anonymous";
        this.players.set(playerId, { name, submitted: false });
        this.broadcastState();
        break;
      }

      case "start": {
        if (this.phase !== "lobby" || this.players.size < 2) return;
        this.phase = "playing";
        this.currentSubmissions.clear();
        for (const p of this.players.values()) p.submitted = false;
        this.broadcastState();
        break;
      }

      case "submit": {
        const player = this.players.get(playerId);
        if (!player || this.phase !== "playing" || player.submitted) return;

        const word = data.word.trim().toLowerCase();
        if (!word) return;

        if (this.usedWords.has(word)) {
          ws.send(JSON.stringify({ type: "error", message: `"${word}" has already been used this game.` }));
          return;
        }

        player.submitted = true;
        this.currentSubmissions.set(playerId, word);
        this.usedWords.add(word);

        const allSubmitted = [...this.players.values()].every((p) => p.submitted);
        if (allSubmitted) {
          this.resolveRound();
        } else {
          this.broadcastState();
        }
        break;
      }

      case "nextRound": {
        if (this.phase !== "reveal") return;
        this.phase = "playing";
        this.currentSubmissions.clear();
        for (const p of this.players.values()) p.submitted = false;
        this.broadcastState();
        break;
      }

      case "reset": {
        this.usedWords.clear();
        this.wins = 0;
        this.rounds = 0;
        this.phase = "playing";
        this.currentSubmissions.clear();
        for (const p of this.players.values()) p.submitted = false;
        this.broadcastState();
        break;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const playerId = this.ctx.getTags(ws)[0];
    this.players.delete(playerId);
    this.currentSubmissions.delete(playerId);

    if (this.phase === "playing" && this.players.size > 0) {
      const allSubmitted = [...this.players.values()].every((p) => p.submitted);
      if (allSubmitted) {
        this.resolveRound();
        return;
      }
    }

    this.broadcastState();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  private resolveRound(): void {
    this.phase = "reveal";
    this.rounds++;

    const submissions = [...this.currentSubmissions.entries()].map(([id, word]) => ({
      name: this.players.get(id)?.name ?? "Unknown",
      word,
    }));

    const words = submissions.map((s) => s.word);
    const won = words.length >= 2 && words.every((w) => w === words[0]);
    if (won) this.wins++;

    this.broadcast({ type: "reveal", submissions, won, wins: this.wins, rounds: this.rounds });
  }

  private broadcastState(): void {
    this.broadcast({
      type: "state",
      phase: this.phase,
      players: [...this.players.entries()].map(([id, p]) => ({
        id,
        name: p.name,
        submitted: p.submitted,
      })),
      wins: this.wins,
      rounds: this.rounds,
    });
  }

  private broadcast(message: object): void {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // connection already closed
      }
    }
  }
}

interface Env {
  GAME_ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Upgrade",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/room\/([A-Z0-9]{4})\/ws$/);
    if (match) {
      const id = env.GAME_ROOM.idFromName(match[1]);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
