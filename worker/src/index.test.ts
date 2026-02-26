import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameRoom } from "./index";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type MockWs = {
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

/**
 * Builds a self-contained GameRoom instance backed by in-memory storage and
 * a dynamic set of mock WebSockets.  The returned helpers let individual tests
 * add/remove connections without touching each other's state.
 */
function createTestRoom() {
  const storage = new Map<string, unknown>();
  const connectedWs = new Set<MockWs>();
  const wsIds = new Map<MockWs, string>();

  const ctx = {
    // Snapshot the current connected set each time it is called, which
    // mirrors what the real runtime does (already-closed sockets are gone).
    getWebSockets: () => Array.from(connectedWs),
    getTags: (ws: MockWs) => [wsIds.get(ws) ?? ""],
    storage: {
      get: (_key: string) => Promise.resolve(storage.get("state")),
      put: (_key: string, value: unknown) => {
        storage.set("state", value);
        return Promise.resolve();
      },
    },
  };

  const room = new GameRoom(ctx as any, {} as any);

  /** Register a new mock WebSocket with the given player-id tag. */
  function connect(id: string): MockWs {
    const ws: MockWs = { send: vi.fn(), close: vi.fn() };
    wsIds.set(ws, id);
    connectedWs.add(ws);
    return ws;
  }

  /**
   * Remove a WebSocket from the connected set.
   * Call this *before* room.webSocketClose() to replicate runtime behaviour
   * (the socket disappears from getWebSockets() before the close handler runs).
   */
  function disconnect(ws: MockWs) {
    connectedWs.delete(ws);
  }

  /** Current persisted game state. */
  function getState() {
    return storage.get("state") as any;
  }

  return { room, connect, disconnect, getState };
}

/** Send a JSON message to the room as if it came from `ws`. */
async function send(room: GameRoom, ws: MockWs, payload: object) {
  await room.webSocketMessage(ws as any, JSON.stringify(payload));
}

/** The last state broadcast received by a particular WebSocket. */
function lastBroadcast(ws: MockWs) {
  const calls = (ws.send as any).mock.calls;
  if (!calls.length) return null;
  return JSON.parse(calls.at(-1)[0]);
}

/** All messages received by a WebSocket, parsed. */
function allMessages(ws: MockWs) {
  return (ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]));
}

// Shared two-player setup used by multiple test groups.
async function twoPlayersInLobby() {
  const env = createTestRoom();
  const ws1 = env.connect("p1");
  const ws2 = env.connect("p2");
  await send(env.room, ws1, { type: "join", playerName: "Alice" });
  await send(env.room, ws2, { type: "join", playerName: "Bob" });
  return { ...env, ws1, ws2 };
}

async function twoPlayersPlaying() {
  const env = await twoPlayersInLobby();
  await send(env.room, env.ws1, { type: "start" });
  return env;
}

// ---------------------------------------------------------------------------
// join
// ---------------------------------------------------------------------------

describe("join", () => {
  it("stores the player name", async () => {
    const { room, connect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "Alice" });
    expect(getState().playerNames["p1"]).toBe("Alice");
  });

  it("trims leading and trailing whitespace", async () => {
    const { room, connect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "  Alice  " });
    expect(getState().playerNames["p1"]).toBe("Alice");
  });

  it("caps the name at 20 characters", async () => {
    const { room, connect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "A".repeat(30) });
    expect(getState().playerNames["p1"]).toBe("A".repeat(20));
  });

  it("falls back to Anonymous when the trimmed name is empty", async () => {
    const { room, connect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "   " });
    expect(getState().playerNames["p1"]).toBe("Anonymous");
  });

  it("initialises playerSubmitted to false", async () => {
    const { room, connect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "Alice" });
    expect(getState().playerSubmitted["p1"]).toBe(false);
  });

  it("broadcasts updated player list after joining", async () => {
    const { room, connect } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "Alice" });
    const broadcast = lastBroadcast(ws);
    expect(broadcast?.type).toBe("state");
    expect(broadcast?.players).toContainEqual(
      expect.objectContaining({ name: "Alice" })
    );
  });

  it("does not include unnamed (connecting) players in broadcasts", async () => {
    const { room, connect } = createTestRoom();
    const ws1 = connect("p1");
    connect("p2"); // connected but never sends join
    await send(room, ws1, { type: "join", playerName: "Alice" });
    const broadcast = lastBroadcast(ws1);
    expect(broadcast?.players).toHaveLength(1);
    expect(broadcast?.players[0].name).toBe("Alice");
  });

  it("re-joining updates an existing player's name", async () => {
    const { room, connect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "Alice" });
    await send(room, ws, { type: "join", playerName: "Alicia" });
    expect(getState().playerNames["p1"]).toBe("Alicia");
  });

  it("sends a welcome message with the player's id after joining", async () => {
    const { room, connect } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "Alice" });
    const welcomeMsg = allMessages(ws).find((m: any) => m.type === "welcome");
    expect(welcomeMsg).toBeDefined();
    expect(welcomeMsg.playerId).toBe("p1");
  });
});

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

describe("start", () => {
  it("requires at least 2 players", async () => {
    const { room, connect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "Alice" });
    await send(room, ws, { type: "start" });
    expect(getState().phase).toBe("lobby");
  });

  it("transitions to playing with 2 or more players", async () => {
    const env = await twoPlayersInLobby();
    await send(env.room, env.ws1, { type: "start" });
    expect(env.getState().phase).toBe("playing");
  });

  it("initialises every player's submitted flag to false", async () => {
    const env = await twoPlayersInLobby();
    await send(env.room, env.ws1, { type: "start" });
    expect(env.getState().playerSubmitted["p1"]).toBe(false);
    expect(env.getState().playerSubmitted["p2"]).toBe(false);
  });

  it("is a no-op when already in the playing phase", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "start" });
    // Still playing, no crash
    expect(env.getState().phase).toBe("playing");
  });
});

// ---------------------------------------------------------------------------
// submit
// ---------------------------------------------------------------------------

describe("submit", () => {
  it("records the word and marks the player as submitted", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    expect(env.getState().currentSubmissions["p1"]).toBe("apple");
    expect(env.getState().playerSubmitted["p1"]).toBe(true);
  });

  it("normalises words to lowercase", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "APPLE" });
    expect(env.getState().currentSubmissions["p1"]).toBe("apple");
  });

  it("ignores a blank submission", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "   " });
    expect(env.getState().playerSubmitted["p1"]).toBe(false);
    expect(env.getState().currentSubmissions["p1"]).toBeUndefined();
  });

  it("ignores a second submission from the same player", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    await send(env.room, env.ws1, { type: "submit", word: "banana" });
    expect(env.getState().currentSubmissions["p1"]).toBe("apple");
  });

  it("rejects a word used in a previous round and sends an error message", async () => {
    const env = await twoPlayersPlaying();
    // Round 1: different words → no win, advances to round 2
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    await send(env.room, env.ws2, { type: "submit", word: "banana" });
    // Round 2: try to reuse "apple"
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    const errorMsg = allMessages(env.ws1).find((m: any) => m.type === "error");
    expect(errorMsg).toBeDefined();
    expect(errorMsg.message).toMatch(/apple/);
  });

  it("does not resolve early when only some players have submitted", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    expect(env.getState().roundHistory).toHaveLength(0);
    expect(env.getState().phase).toBe("playing");
  });

  it("resolves the round when every player submits", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    await send(env.room, env.ws2, { type: "submit", word: "apple" });
    expect(env.getState().roundHistory).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// resolveRound
// ---------------------------------------------------------------------------

describe("resolveRound", () => {
  it("transitions to 'won' when all players submit the same word", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "meld" });
    await send(env.room, env.ws2, { type: "submit", word: "meld" });
    expect(env.getState().phase).toBe("won");
    expect(env.getState().roundHistory[0].won).toBe(true);
  });

  it("remains in 'playing' and advances the round when words differ", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    await send(env.room, env.ws2, { type: "submit", word: "banana" });
    expect(env.getState().phase).toBe("playing");
    expect(env.getState().roundHistory[0].won).toBe(false);
  });

  it("resets currentSubmissions and playerSubmitted after a non-winning round", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    await send(env.room, env.ws2, { type: "submit", word: "banana" });
    expect(env.getState().currentSubmissions).toEqual({});
    expect(env.getState().playerSubmitted["p1"]).toBe(false);
    expect(env.getState().playerSubmitted["p2"]).toBe(false);
  });

  it("records both players' names and words in round history", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    await send(env.room, env.ws2, { type: "submit", word: "banana" });
    const round = env.getState().roundHistory[0];
    const nameWordPairs = round.submissions.map((s: any) => [s.name, s.word]);
    expect(nameWordPairs).toContainEqual(["Alice", "apple"]);
    expect(nameWordPairs).toContainEqual(["Bob", "banana"]);
  });

  it("includes the player id in each submission in round history", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    await send(env.room, env.ws2, { type: "submit", word: "banana" });
    const round = env.getState().roundHistory[0];
    const idWordPairs = round.submissions.map((s: any) => [s.id, s.word]);
    expect(idWordPairs).toContainEqual(["p1", "apple"]);
    expect(idWordPairs).toContainEqual(["p2", "banana"]);
  });

  it("adds submitted words to usedWords to prevent reuse", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    await send(env.room, env.ws2, { type: "submit", word: "banana" });
    expect(env.getState().usedWords).toContain("apple");
    expect(env.getState().usedWords).toContain("banana");
  });

  it("requires at least 2 submissions to win (single-submission round is not a win)", async () => {
    // Regression: resolving with a single submission should never be marked won
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    // Disconnect ws2 without submitting so the round resolves with just Alice
    env.disconnect(env.ws2);
    await env.room.webSocketClose(env.ws2 as any);
    // p1 is the only remaining player; their submission triggers resolve
    // (allDone=true, currentSubmissions has p1's word)
    const state = env.getState();
    if (state.roundHistory.length > 0) {
      expect(state.roundHistory[0].won).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// webSocketClose (disconnect handling)
// ---------------------------------------------------------------------------

describe("webSocketClose", () => {
  it("removes the player's name and submission status", async () => {
    const { room, connect, disconnect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "Alice" });
    disconnect(ws);
    await room.webSocketClose(ws as any);
    expect(getState().playerNames["p1"]).toBeUndefined();
    expect(getState().playerSubmitted["p1"]).toBeUndefined();
  });

  it("resets to lobby when the last player disconnects", async () => {
    const { room, connect, disconnect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "Alice" });
    disconnect(ws);
    await room.webSocketClose(ws as any);
    expect(getState().phase).toBe("lobby");
  });

  it("removes a submitted player's word from currentSubmissions on disconnect", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });
    expect(env.getState().currentSubmissions["p1"]).toBe("apple");

    env.disconnect(env.ws1);
    await env.room.webSocketClose(env.ws1 as any);

    expect(env.getState().currentSubmissions["p1"]).toBeUndefined();
  });

  it("does not produce 'Unknown' in round history when a player disconnects after submitting", async () => {
    // Regression test for the disconnect bug:
    // Alice submits, disconnects; Bob submits → resolveRound must not use
    // Alice's orphaned submission with a missing name.
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "apple" });

    env.disconnect(env.ws1);
    await env.room.webSocketClose(env.ws1 as any);

    // Bob submits — allSubmitted is now true for remaining players
    await send(env.room, env.ws2, { type: "submit", word: "banana" });

    const allNames = env
      .getState()
      .roundHistory.flatMap((r: any) => r.submissions.map((s: any) => s.name));
    expect(allNames).not.toContain("Unknown");
    // Alice's orphaned word must not appear either
    expect(allNames).not.toContain("Alice");
    expect(allNames).toContain("Bob");
  });

  it("resolves the round immediately when all remaining players have already submitted", async () => {
    // Carol is the last to submit but disconnects before doing so;
    // the round should resolve for Alice and Bob immediately.
    const { room, connect, disconnect, getState } = createTestRoom();
    const ws1 = connect("p1");
    const ws2 = connect("p2");
    const ws3 = connect("p3");
    await send(room, ws1, { type: "join", playerName: "Alice" });
    await send(room, ws2, { type: "join", playerName: "Bob" });
    await send(room, ws3, { type: "join", playerName: "Carol" });
    await send(room, ws1, { type: "start" });

    await send(room, ws1, { type: "submit", word: "apple" });
    await send(room, ws2, { type: "submit", word: "apple" });
    expect(getState().roundHistory).toHaveLength(0); // not yet resolved

    disconnect(ws3);
    await room.webSocketClose(ws3 as any);

    // Alice and Bob both submitted "apple" → should be a win
    expect(getState().roundHistory).toHaveLength(1);
    expect(getState().roundHistory[0].won).toBe(true);
  });

  it("broadcasts the remaining player list after a disconnect", async () => {
    const env = await twoPlayersInLobby();
    env.disconnect(env.ws2);
    await env.room.webSocketClose(env.ws2 as any);

    const broadcast = lastBroadcast(env.ws1);
    const names = broadcast?.players?.map((p: any) => p.name) ?? [];
    expect(names).toContain("Alice");
    expect(names).not.toContain("Bob");
  });
});

// ---------------------------------------------------------------------------
// broadcastState — unnamed player filtering
// ---------------------------------------------------------------------------

describe("broadcastState (unnamed player filtering)", () => {
  it("excludes a connected socket that has not yet sent a join message", async () => {
    const { room, connect } = createTestRoom();
    const ws1 = connect("p1");
    connect("p2"); // connected but no join message sent
    await send(room, ws1, { type: "join", playerName: "Alice" });

    const broadcast = lastBroadcast(ws1);
    expect(broadcast?.players).toHaveLength(1);
    expect(broadcast?.players[0].name).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe("reset", () => {
  it("starts a fresh game in the playing phase", async () => {
    const env = await twoPlayersPlaying();
    // Win the game first
    await send(env.room, env.ws1, { type: "submit", word: "meld" });
    await send(env.room, env.ws2, { type: "submit", word: "meld" });
    expect(env.getState().phase).toBe("won");

    await send(env.room, env.ws1, { type: "reset" });
    expect(env.getState().phase).toBe("playing");
  });

  it("preserves the names of currently connected players", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "meld" });
    await send(env.room, env.ws2, { type: "submit", word: "meld" });

    await send(env.room, env.ws1, { type: "reset" });
    expect(env.getState().playerNames["p1"]).toBe("Alice");
    expect(env.getState().playerNames["p2"]).toBe("Bob");
  });

  it("clears round history and used words", async () => {
    const env = await twoPlayersPlaying();
    await send(env.room, env.ws1, { type: "submit", word: "meld" });
    await send(env.room, env.ws2, { type: "submit", word: "meld" });

    await send(env.room, env.ws1, { type: "reset" });
    expect(env.getState().roundHistory).toHaveLength(0);
    expect(env.getState().usedWords).toHaveLength(0);
  });

  it("excludes unnamed (still-connecting) players from the reset game", async () => {
    const { room, connect, getState } = createTestRoom();
    const ws1 = connect("p1");
    connect("p2"); // connected but never sent join
    await send(room, ws1, { type: "join", playerName: "Alice" });
    await send(room, ws1, { type: "reset" });

    expect(Object.keys(getState().playerNames)).toEqual(["p1"]);
  });
});

// ---------------------------------------------------------------------------
// ping / pong
// ---------------------------------------------------------------------------

describe("ping / pong", () => {
  it("responds to a ping with a pong without touching game state", async () => {
    const { room, connect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "Alice" });
    (ws.send as any).mockClear();

    await send(room, ws, { type: "ping" });
    expect(ws.send).toHaveBeenCalledOnce();
    expect(JSON.parse((ws.send as any).mock.calls[0][0])).toEqual({ type: "pong" });
    // State is unchanged — ping does not persist anything
    expect(getState().playerNames["p1"]).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// webSocketError
// ---------------------------------------------------------------------------

describe("webSocketError", () => {
  it("delegates to webSocketClose, cleaning up player state", async () => {
    const { room, connect, disconnect, getState } = createTestRoom();
    const ws = connect("p1");
    await send(room, ws, { type: "join", playerName: "Alice" });

    disconnect(ws);
    await room.webSocketError(ws as any);

    expect(getState().playerNames["p1"]).toBeUndefined();
  });
});
