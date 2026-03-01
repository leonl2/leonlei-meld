"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ServerPhase, Player, RoundEntry, GameConfig } from "@shared/types";
import { DEFAULT_CONFIG } from "@shared/types";

// Re-export shared types consumed by other modules via this path
export type { Player, RoundEntry, GameConfig } from "@shared/types";

export type Phase = ServerPhase | "connecting";

export interface GameState {
  phase: Phase;
  players: Player[];
  roundHistory: RoundEntry[];
  restartVotes: string[];
  config: GameConfig;
}

const INITIAL_STATE: GameState = {
  phase: "connecting",
  players: [],
  roundHistory: [],
  restartVotes: [],
  config: DEFAULT_CONFIG,
};

const PING_INTERVAL_MS = 20_000;
const RECONNECT_DELAY_MS = 2_000;

export function useGameRoom(roomCode: string, playerName: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [mySubmittedWord, setMySubmittedWord] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const sendRef = useRef<(msg: object) => void>(() => {});

  useEffect(() => {
    if (!playerName || !roomCode) return;
    mountedRef.current = true;

    let reconnectTimer: ReturnType<typeof setTimeout>;
    let pingTimer: ReturnType<typeof setInterval>;

    function connect() {
      if (!mountedRef.current) return;

      const base = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";
      const wsUrl = base.replace(/^http/, "ws") + `/room/${roomCode}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      sendRef.current = (msg: object) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      };

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        ws.send(JSON.stringify({ type: "join", playerName }));
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        const data = JSON.parse(event.data as string);

        if (data.type === "pong") return;

        if (data.type === "welcome") {
          setMyId(data.playerId);
          return;
        }

        if (data.type === "error") {
          setError(data.message);
          setTimeout(() => setError(null), 3000);
          return;
        }

        if (data.type === "state") {
          setState({
            phase: data.phase,
            players: data.players,
            roundHistory: data.roundHistory ?? [],
            restartVotes: data.restartVotes ?? [],
            config: data.config ?? DEFAULT_CONFIG,
          });
        }
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        if (!mountedRef.current) return;
        setConnected(false);
        setMyId(null);
        setMySubmittedWord(null);
        setState((prev) => ({ ...prev, phase: "connecting", restartVotes: [] }));
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      wsRef.current?.close();
    };
  }, [roomCode, playerName]);

  const send = useCallback((msg: object) => sendRef.current(msg), []);

  // Clear submitted word when a new round starts (history grows) or game restarts (history resets)
  const prevRoundHistoryLen = useRef(0);
  useEffect(() => {
    const newLen = state.roundHistory.length;
    const prevLen = prevRoundHistoryLen.current;
    prevRoundHistoryLen.current = newLen;
    if (newLen > prevLen || (newLen === 0 && prevLen > 0)) {
      setTimeout(() => setMySubmittedWord(null), 0);
    }
  }, [state.roundHistory.length]);

  return {
    state,
    error,
    connected,
    myId,
    mySubmittedWord,
    start: () => send({ type: "start" }),
    submit: (word: string) => {
      setMySubmittedWord(word);
      send({ type: "submit", word });
    },
    retract: () => {
      setMySubmittedWord(null);
      send({ type: "retract" });
    },
    requestReset: () => send({ type: "reset_request" }),
    cancelReset: () => send({ type: "reset_cancel" }),
    requestRestart: () => send({ type: "restart_request" }),
    cancelRestart: () => send({ type: "restart_cancel" }),
  };
}
